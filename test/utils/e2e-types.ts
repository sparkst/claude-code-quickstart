/**
 * E2E Test Types - Core interfaces for test infrastructure
 * REQ-500: Missing Test Utilities Infrastructure
 */

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  args: readonly string[];
  duration: number;
  timestamp: Date;
}

export interface ExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
  captureOutput?: boolean;
}

export interface CliExecutor {
  execute(command: string, args: readonly string[], options?: ExecutionOptions): Promise<ExecutionResult>;
  cleanup(): Promise<void>;
}

export interface TestEnvironment {
  tempDir: string;
  cleanup(): Promise<void>;
  createFile(relativePath: string, content: string): Promise<string>;
  createDirectory(relativePath: string): Promise<string>;
}

export interface WorkflowValidator {
  validateStep(step: WorkflowStep): Promise<boolean>;
  validateComplete(workflow: WorkflowStep[]): Promise<boolean>;
}

export interface UserSimulator {
  simulateInput(input: string): Promise<void>;
  simulateKeypress(key: string): Promise<void>;
  simulateInteraction(action: UserAction): Promise<void>;
}

export interface SecurityValidator {
  validateCommand(command: string, args: readonly string[]): SecurityValidationResult;
  validatePath(path: string): boolean;
  validateUrl(url: string): boolean;
}

export interface ProcessManager {
  spawn(command: string, args: readonly string[], options?: ExecutionOptions): Promise<ProcessInfo>;
  kill(processId: ProcessId): Promise<void>;
  killAll(): Promise<void>;
  getRunningProcesses(): ProcessInfo[];
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

export interface SecurityValidationResult {
  isValid: boolean;
  violations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
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