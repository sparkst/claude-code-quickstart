/**
 * E2E Test Types - Core interfaces for test infrastructure
 * REQ-500: Missing Test Utilities Infrastructure
 */

export interface ExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
  captureOutput?: boolean;
}

export interface CliExecutor {
  execute(args: readonly string[], options?: ExecutionOptions): Promise<ExecutionResult>;
  spawn(command: string, args: readonly string[], options?: ExecutionOptions): Promise<ExecutionResult>;
  kill(pid: number): Promise<void>;
  cleanup(): Promise<void>;
}

export interface TestEnvironment {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createTempDir(baseName?: string): Promise<string>;
  cleanup(): Promise<void>;
  createTempFile(fileName: string): Promise<string>;
  acquireResource(resourceId: string): Promise<any>;
  releaseResource(resourceId: string): Promise<void>;
  isResourceActive(resourceId: string): Promise<boolean>;
}

export interface WorkflowValidator {
  validateWorkflow(workflow: WorkflowStep[]): Promise<ValidationResult>;
  validateSteps(steps: WorkflowStep[]): Promise<ValidationResult>;
  validateExpectations(result: ExecutionResult, expected: any): Promise<ValidationResult>;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface UserSimulator {
  simulateInput(input: string): Promise<void>;
  simulateKeypress(key: string): Promise<void>;
  simulateInteraction(action: UserAction): Promise<void>;
}

export interface ProcessManager {
  spawn(command: string, args: readonly string[], options?: ExecutionOptions): Promise<ProcessInfo>;
  kill(processId: ProcessId): Promise<void>;
  killAll(): Promise<void>;
  getActiveProcesses(): ProcessId[];
  isProcessActive(pid: ProcessId): Promise<boolean>;
  handleError(errorType: string): Promise<{ recovered: boolean; cleanup: boolean; resourcesReleased: boolean }>;
}

export interface WorkflowStep {
  command: string;
  args: readonly string[];
  expectedExitCode?: number;
  timeout?: number;
  description?: string;
}

export interface ProcessInfo {
  pid: ProcessId;
  command: string;
  args: readonly string[];
  startTime: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
}

export interface UserAction {
  type: 'input' | 'keypress' | 'select' | 'confirm';
  value: string;
  timeout?: number;
}

// REQ-800: Security Validator Types for comprehensive security checking
export type ThreatLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityCheckResult {
  safe: boolean;
  threatLevel: ThreatLevel;
  threats: string[];
  reason: string;
}

export interface SecurityValidator {
  validateCommand(command: readonly string[]): Promise<SecurityCheckResult>;
  validatePath(path: string): Promise<SecurityCheckResult>;
  validateEnvironment(env: Record<string, string>): Promise<SecurityCheckResult>;
  validateInput(input: any): Promise<SecurityCheckResult>;
}

export type ProcessId = number;

export class E2EError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'E2EError';
  }
}