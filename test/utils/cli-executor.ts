/**
 * CLI Execution Module - Real subprocess execution with security
 * REQ-202: Real CLI Execution
 * REQ-203: Security Hardening
 */

import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  WorkflowStep,
  CommandResult,
  ProcessInfo,
  ProcessResult,
  ProcessId,
  SecurityValidationResult,
  E2EError
} from './types.js';

// Security constants
const MAX_COMMAND_LENGTH = 1000;
const MAX_ARG_LENGTH = 500;
const ALLOWED_COMMANDS = ['node', 'npm', 'npx'] as const;
const DANGEROUS_PATTERNS = [
  /[;&|`$(){}[\]]/,  // Shell metacharacters
  /\.\./,             // Path traversal
  /__proto__/,        // Prototype pollution
  /eval|exec|system/i // Code execution
] as const;

/**
 * Validates command arguments for security
 * REQ-203: Input sanitization and injection prevention
 */
export function validateCommandSecurity(command: string, args: readonly string[]): SecurityValidationResult {
  // Validate command length
  if (command.length > MAX_COMMAND_LENGTH) {
    return {
      inputSanitized: false,
      pathValidated: false,
      envVarsSafe: false,
      noInjectionVulnerabilities: false
    };
  }

  // Validate command is allowed
  const isAllowedCommand = ALLOWED_COMMANDS.some(allowed => command.includes(allowed));
  if (!isAllowedCommand) {
    return {
      inputSanitized: false,
      pathValidated: false,
      envVarsSafe: false,
      noInjectionVulnerabilities: false
    };
  }

  // Validate arguments
  for (const arg of args) {
    if (arg.length > MAX_ARG_LENGTH) {
      return {
        inputSanitized: false,
        pathValidated: false,
        envVarsSafe: false,
        noInjectionVulnerabilities: false
      };
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(arg)) {
        return {
          inputSanitized: false,
          pathValidated: false,
          envVarsSafe: false,
          noInjectionVulnerabilities: false
        };
      }
    }
  }

  return {
    inputSanitized: true,
    pathValidated: true,
    envVarsSafe: true,
    noInjectionVulnerabilities: true
  };
}

/**
 * Validates file paths for security
 * REQ-203: Path validation and traversal prevention
 */
export function validatePath(filePath: string): boolean {
  try {
    const resolved = path.resolve(filePath);
    const normalized = path.normalize(filePath);
    
    // Prevent path traversal
    if (normalized.includes('..') || normalized.startsWith('/etc') || normalized.startsWith('/usr')) {
      return false;
    }
    
    // Ensure path is within allowed directories
    const cwd = process.cwd();
    const tmpDir = require('os').tmpdir();
    
    return resolved.startsWith(cwd) || resolved.startsWith(tmpDir);
  } catch {
    return false;
  }
}

/**
 * Sanitizes environment variables
 * REQ-203: Environment variable injection prevention
 */
export function sanitizeEnvironmentVariables(env: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(env)) {
    // Validate key
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
      continue; // Skip invalid keys
    }
    
    // Sanitize value
    if (typeof value === 'string' && value.length < 1000) {
      // Remove dangerous characters
      const cleanValue = value.replace(/[;&|`$(){}[\]]/g, '');
      sanitized[key] = cleanValue;
    }
  }
  
  return sanitized;
}

/**
 * Executes a CLI command with security validation
 * REQ-202: Real CLI process execution
 * REQ-203: Security hardening
 */
export async function executeCliCommand(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd?: string;
    readonly env?: Record<string, string>;
    readonly input?: string;
    readonly timeout?: number;
  } = {}
): Promise<CommandResult> {
  const { cwd = process.cwd(), env = {}, input = '', timeout = 5000 } = options;

  // Security validation
  const securityResult = validateCommandSecurity(command, args);
  if (!securityResult.noInjectionVulnerabilities) {
    throw new Error('Command failed security validation') as E2EError;
  }

  // Path validation
  if (!validatePath(cwd)) {
    throw new Error('Invalid working directory path') as E2EError;
  }

  // Sanitize environment
  const sanitizedEnv = sanitizeEnvironmentVariables(env);
  const processEnv = { ...process.env, ...sanitizedEnv };

  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(command, [...args], {
      cwd,
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout;

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`) as E2EError);
      }, timeout);
    }

    // Handle stdout
    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    // Handle stderr
    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    // Handle input
    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    // Handle process completion
    child.on('close', (code: number | null) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      resolve({
        code: code ?? -1,
        stdout,
        stderr
      });
    });

    // Handle process errors
    child.on('error', (error: Error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });
  });
}

/**
 * Executes a complete workflow with multiple CLI commands
 * REQ-202: Real CLI workflow execution
 */
export async function executeWorkflow(steps: readonly WorkflowStep[]): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  
  for (const step of steps) {
    const startTime = Date.now();
    
    try {
      const result = await executeCliCommand('node', step.args, {
        cwd: process.cwd(),
        env: step.env || {},
        input: step.input || '',
        timeout: step.timeout || 5000
      });
      
      const duration = Date.now() - startTime;
      const success = step.expectSuccess !== false ? result.code === 0 : result.code !== 0;
      
      // Validate expected output if specified
      if (step.expectedOutput && !result.stdout.includes(step.expectedOutput)) {
        throw new Error(`Expected output "${step.expectedOutput}" not found`);
      }
      
      // Validate expected error if specified
      if (step.expectedError && !result.stderr.includes(step.expectedError)) {
        throw new Error(`Expected error "${step.expectedError}" not found`);
      }
      
      results.push({
        success,
        processInfo: {
          pid: process.pid as ProcessId,
          command: 'node',
          args: step.args,
          startTime
        },
        result,
        duration
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      results.push({
        success: false,
        processInfo: {
          pid: process.pid as ProcessId,
          command: 'node',
          args: step.args,
          startTime
        },
        result: {
          code: -1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error)
        },
        duration
      });
    }
  }
  
  return results;
}

/**
 * Checks if a command exists and is executable
 * REQ-202: Command validation
 */
export async function validateCommandExists(command: string): Promise<boolean> {
  try {
    const result = await executeCliCommand('which', [command], { timeout: 1000 });
    return result.code === 0;
  } catch {
    return false;
  }
}

/**
 * Gets the path to the CLI binary
 * REQ-202: CLI path resolution
 */
export function getCliPath(): string {
  const cliPath = path.resolve('./bin/cli.js');
  
  if (!validatePath(cliPath)) {
    throw new Error('CLI path validation failed') as E2EError;
  }
  
  return cliPath;
}