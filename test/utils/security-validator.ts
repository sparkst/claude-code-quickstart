/**
 * Security Validation Module - Comprehensive security hardening
 * REQ-203: Security Hardening - Input sanitization and vulnerability prevention
 */

import type { SecurityValidationResult, E2EError } from './types.js';

// Security configuration constants
const SECURITY_LIMITS = {
  MAX_INPUT_LENGTH: 10000,
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_DEPTH: 20,
  MAX_ENV_VAR_LENGTH: 1000,
  MAX_COMMAND_ARGS: 50
} as const;

// Dangerous patterns for detection
const INJECTION_PATTERNS = {
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]]/,      // Shell metacharacters
    /\$\{.*\}/,            // Variable expansion
    /`.*`/,                // Command substitution
    /\$\(.*\)/,            // Command substitution
  ],
  PATH_TRAVERSAL: [
    /\.\./,                // Directory traversal
    /\/\.\./,              // Absolute traversal
    /\.\.\//,              // Relative traversal
    /~\//,                 // Home directory access
  ],
  CODE_INJECTION: [
    /eval\s*\(/i,          // eval() calls
    /exec\s*\(/i,          // exec() calls
    /system\s*\(/i,        // system() calls
    /require\s*\(/i,       // require() calls
    /__proto__/i,          // Prototype pollution
    /constructor/i,        // Constructor access
  ],
  BUFFER_OVERFLOW: [
    /\x00/,                // NULL bytes
    /\xff/,                // 0xFF bytes
    /.{10000,}/,           // Excessive length
  ]
} as const;

// Allowed file extensions
const SAFE_EXTENSIONS = ['.js', '.ts', '.json', '.md', '.txt', '.log'] as const;

/**
 * Validates input for command injection attacks
 * REQ-203: Command injection prevention
 */
export function validateCommandInjection(input: string): boolean {
  if (input.length > SECURITY_LIMITS.MAX_INPUT_LENGTH) {
    return false;
  }

  for (const pattern of INJECTION_PATTERNS.COMMAND_INJECTION) {
    if (pattern.test(input)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates paths for traversal attacks
 * REQ-203: Path traversal protection
 */
export function validatePathTraversal(filePath: string): boolean {
  if (filePath.length > SECURITY_LIMITS.MAX_FILENAME_LENGTH) {
    return false;
  }

  for (const pattern of INJECTION_PATTERNS.PATH_TRAVERSAL) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  // Check path depth
  const pathParts = filePath.split('/').filter(part => part !== '');
  if (pathParts.length > SECURITY_LIMITS.MAX_PATH_DEPTH) {
    return false;
  }

  return true;
}

/**
 * Validates environment variables for injection attacks
 * REQ-203: Environment variable sanitization
 */
export function validateEnvironmentVariables(env: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(env)) {
    // Validate key format
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
      return false;
    }

    // Validate value length
    if (value.length > SECURITY_LIMITS.MAX_ENV_VAR_LENGTH) {
      return false;
    }

    // Check for injection patterns
    for (const patterns of Object.values(INJECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Validates file extensions for safety
 * REQ-203: File type validation
 */
export function validateFileExtension(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop();
  if (!extension) {
    return false;
  }

  return SAFE_EXTENSIONS.includes(`.${extension}` as any);
}

/**
 * Checks for buffer overflow vulnerabilities
 * REQ-203: Buffer overflow prevention
 */
export function validateBufferOverflow(data: string | Buffer): boolean {
  const input = typeof data === 'string' ? data : data.toString();

  for (const pattern of INJECTION_PATTERNS.BUFFER_OVERFLOW) {
    if (pattern.test(input)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates command arguments for security
 * REQ-203: Argument validation
 */
export function validateCommandArguments(args: readonly string[]): boolean {
  if (args.length > SECURITY_LIMITS.MAX_COMMAND_ARGS) {
    return false;
  }

  for (const arg of args) {
    if (!validateCommandInjection(arg)) {
      return false;
    }
    
    if (!validateBufferOverflow(arg)) {
      return false;
    }
  }

  return true;
}

/**
 * Comprehensive security validation for all inputs
 * REQ-203: Complete security validation
 */
export function performSecurityValidation(
  command: string,
  args: readonly string[],
  env: Record<string, string> = {},
  workingDir: string = process.cwd()
): SecurityValidationResult {
  try {
    const commandValid = validateCommandInjection(command);
    const argsValid = validateCommandArguments(args);
    const envValid = validateEnvironmentVariables(env);
    const pathValid = validatePathTraversal(workingDir);

    return {
      inputSanitized: commandValid && argsValid,
      pathValidated: pathValid,
      envVarsSafe: envValid,
      noInjectionVulnerabilities: commandValid && argsValid && envValid && pathValid
    };
  } catch (error) {
    return {
      inputSanitized: false,
      pathValidated: false,
      envVarsSafe: false,
      noInjectionVulnerabilities: false
    };
  }
}

/**
 * Sanitizes user input by removing dangerous characters
 * REQ-203: Input sanitization
 */
export function sanitizeUserInput(input: string): string {
  if (!validateBufferOverflow(input)) {
    throw new Error('Input exceeds safe length limits') as E2EError;
  }

  // Remove shell metacharacters
  let sanitized = input.replace(/[;&|`$(){}[\]]/g, '');
  
  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');
  
  // Remove NULL bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
  
  // Limit length
  if (sanitized.length > SECURITY_LIMITS.MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, SECURITY_LIMITS.MAX_INPUT_LENGTH);
  }

  return sanitized;
}

/**
 * Validates that a string is safe for use in shell commands
 * REQ-203: Shell command safety
 */
export function validateShellSafety(input: string): boolean {
  // Check for command injection patterns
  if (!validateCommandInjection(input)) {
    return false;
  }

  // Check for code injection patterns
  for (const pattern of INJECTION_PATTERNS.CODE_INJECTION) {
    if (pattern.test(input)) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a security report for audit purposes
 * REQ-203: Security audit reporting
 */
export function generateSecurityReport(
  validationResult: SecurityValidationResult,
  command: string,
  args: readonly string[],
  env: Record<string, string>
): {
  readonly secure: boolean;
  readonly violations: readonly string[];
  readonly recommendations: readonly string[];
} {
  const violations: string[] = [];
  const recommendations: string[] = [];

  if (!validationResult.inputSanitized) {
    violations.push('Input sanitization failed');
    recommendations.push('Sanitize all user inputs before processing');
  }

  if (!validationResult.pathValidated) {
    violations.push('Path validation failed');
    recommendations.push('Validate all file paths to prevent traversal attacks');
  }

  if (!validationResult.envVarsSafe) {
    violations.push('Environment variables validation failed');
    recommendations.push('Sanitize all environment variables');
  }

  if (!validationResult.noInjectionVulnerabilities) {
    violations.push('Injection vulnerabilities detected');
    recommendations.push('Use parameterized queries and escape special characters');
  }

  return {
    secure: violations.length === 0,
    violations,
    recommendations
  };
}