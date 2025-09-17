/**
 * Process Management Module - Resource cleanup and lifecycle management
 * REQ-205: Resource Management - Proper cleanup and error handling
 * REQ-802: E2E Test Infrastructure Fixes
 */

import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type {
  ProcessInfo,
  ProcessId,
  ProcessManager,
  ExecutionOptions
} from './e2e-types.js';

// Resource tracking
const activeProcesses = new Map<ProcessId, ProcessInfo>();
const tempDirectories = new Set<string>();
const tempFiles = new Set<string>();
const cleanupCallbacks = new Set<() => Promise<void>>();

// Resource limits
const RESOURCE_LIMITS = {
  MAX_PROCESSES: 10,
  MAX_TEMP_DIRS: 20,
  MAX_TEMP_FILES: 100,
  CLEANUP_TIMEOUT_MS: 5000,
  PROCESS_KILL_TIMEOUT_MS: 2000
} as const;

/**
 * Registers a process for tracking and cleanup
 * REQ-205: Process lifecycle management
 */
export function registerProcess(processInfo: ProcessInfo): void {
  if (activeProcesses.size >= RESOURCE_LIMITS.MAX_PROCESSES) {
    throw new Error(`Maximum number of processes (${RESOURCE_LIMITS.MAX_PROCESSES}) exceeded`) as E2EError;
  }

  activeProcesses.set(processInfo.pid, processInfo);
}

/**
 * Unregisters a process from tracking
 * REQ-205: Process cleanup
 */
export function unregisterProcess(pid: ProcessId): void {
  activeProcesses.delete(pid);
}

/**
 * Gets all active processes
 * REQ-205: Process monitoring
 */
export function getActiveProcesses(): readonly ProcessInfo[] {
  return Array.from(activeProcesses.values());
}

/**
 * Kills a process gracefully with fallback to force kill
 * REQ-205: Graceful process termination
 */
export async function killProcess(pid: ProcessId): Promise<boolean> {
  try {
    // Try graceful termination first
    process.kill(Number(pid), 'SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if process is still running
    try {
      process.kill(Number(pid), 0); // Signal 0 checks if process exists
      // Process still exists, force kill
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      // Process no longer exists (graceful shutdown succeeded)
    }
    
    unregisterProcess(pid);
    return true;
  } catch (error) {
    // Process might already be dead
    unregisterProcess(pid);
    return false;
  }
}

/**
 * Kills all active processes
 * REQ-205: Cleanup all processes
 */
export async function killAllProcesses(): Promise<CleanupResult> {
  const cleaned: string[] = [];
  const errors: string[] = [];
  
  const processIds = Array.from(activeProcesses.keys());
  
  for (const pid of processIds) {
    try {
      const success = await killProcess(pid);
      if (success) {
        cleaned.push(`Process ${pid}`);
      } else {
        errors.push(`Failed to kill process ${pid}`);
      }
    } catch (error) {
      errors.push(`Error killing process ${pid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return {
    cleaned,
    errors,
    success: errors.length === 0
  };
}

/**
 * Creates a temporary directory with tracking
 * REQ-205: Temporary resource management
 */
export async function createTempDirectory(prefix: string = 'claude-test-'): Promise<string> {
  if (tempDirectories.size >= RESOURCE_LIMITS.MAX_TEMP_DIRS) {
    throw new Error(`Maximum number of temp directories (${RESOURCE_LIMITS.MAX_TEMP_DIRS}) exceeded`) as E2EError;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirectories.add(tempDir);
  
  return tempDir;
}

/**
 * Creates a temporary file with tracking
 * REQ-205: Temporary file management
 */
export async function createTempFile(content: string = '', extension: string = '.tmp'): Promise<string> {
  if (tempFiles.size >= RESOURCE_LIMITS.MAX_TEMP_FILES) {
    throw new Error(`Maximum number of temp files (${RESOURCE_LIMITS.MAX_TEMP_FILES}) exceeded`) as E2EError;
  }

  const tempDir = os.tmpdir();
  const fileName = `claude-test-${Date.now()}${extension}`;
  const filePath = path.join(tempDir, fileName);
  
  await fs.writeFile(filePath, content);
  tempFiles.add(filePath);
  
  return filePath;
}

/**
 * Removes a temporary directory
 * REQ-205: Directory cleanup
 */
export async function removeTempDirectory(dirPath: string): Promise<boolean> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    tempDirectories.delete(dirPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Removes a temporary file
 * REQ-205: File cleanup
 */
export async function removeTempFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    tempFiles.delete(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Cleans up all temporary directories
 * REQ-205: Complete directory cleanup
 */
export async function cleanupAllTempDirectories(): Promise<CleanupResult> {
  const cleaned: string[] = [];
  const errors: string[] = [];
  
  for (const dir of tempDirectories) {
    const success = await removeTempDirectory(dir);
    if (success) {
      cleaned.push(`Directory: ${dir}`);
    } else {
      errors.push(`Failed to remove directory: ${dir}`);
    }
  }
  
  return {
    cleaned,
    errors,
    success: errors.length === 0
  };
}

/**
 * Cleans up all temporary files
 * REQ-205: Complete file cleanup
 */
export async function cleanupAllTempFiles(): Promise<CleanupResult> {
  const cleaned: string[] = [];
  const errors: string[] = [];
  
  for (const file of tempFiles) {
    const success = await removeTempFile(file);
    if (success) {
      cleaned.push(`File: ${file}`);
    } else {
      errors.push(`Failed to remove file: ${file}`);
    }
  }
  
  return {
    cleaned,
    errors,
    success: errors.length === 0
  };
}

/**
 * Registers a cleanup callback
 * REQ-205: Custom cleanup registration
 */
export function registerCleanupCallback(callback: () => Promise<void>): void {
  cleanupCallbacks.add(callback);
}

/**
 * Executes all cleanup callbacks
 * REQ-205: Execute custom cleanup
 */
export async function executeCleanupCallbacks(): Promise<CleanupResult> {
  const cleaned: string[] = [];
  const errors: string[] = [];
  
  for (const callback of cleanupCallbacks) {
    try {
      await callback();
      cleaned.push('Custom cleanup callback');
    } catch (error) {
      errors.push(`Cleanup callback error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  cleanupCallbacks.clear();
  
  return {
    cleaned,
    errors,
    success: errors.length === 0
  };
}

/**
 * Comprehensive cleanup of all resources
 * REQ-205: Complete resource cleanup
 */
export async function performCompleteCleanup(): Promise<CleanupResult> {
  const allCleaned: string[] = [];
  const allErrors: string[] = [];
  
  // Cleanup processes
  const processCleanup = await killAllProcesses();
  allCleaned.push(...processCleanup.cleaned);
  allErrors.push(...processCleanup.errors);
  
  // Cleanup directories
  const dirCleanup = await cleanupAllTempDirectories();
  allCleaned.push(...dirCleanup.cleaned);
  allErrors.push(...dirCleanup.errors);
  
  // Cleanup files
  const fileCleanup = await cleanupAllTempFiles();
  allCleaned.push(...fileCleanup.cleaned);
  allErrors.push(...fileCleanup.errors);
  
  // Execute custom cleanup callbacks
  const callbackCleanup = await executeCleanupCallbacks();
  allCleaned.push(...callbackCleanup.cleaned);
  allErrors.push(...callbackCleanup.errors);
  
  return {
    cleaned: allCleaned,
    errors: allErrors,
    success: allErrors.length === 0
  };
}

/**
 * Creates an E2E test environment with proper tracking
 * REQ-205: Environment lifecycle management
 */
export async function createE2EEnvironment(prefix: string = 'e2e-'): Promise<E2EEnvironment> {
  const tempDir = await createTempDirectory(prefix);
  const claudeConfigDir = path.join(tempDir, '.claude');
  
  // Create Claude config directory
  await fs.mkdir(claudeConfigDir, { recursive: true });
  
  // Create mock config file
  const claudeConfigPath = path.join(claudeConfigDir, 'claude_desktop_config.json');
  const mockConfig = {
    mcpServers: {
      github: {
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        env: {}
      }
    }
  };
  
  await fs.writeFile(claudeConfigPath, JSON.stringify(mockConfig, null, 2));
  
  const environment: E2EEnvironment = {
    id: `env-${Date.now()}` as TestEnvironmentId,
    tempDir,
    claudeConfigPath,
    cleanup: [
      () => removeTempDirectory(tempDir).then(() => undefined)
    ]
  };
  
  return environment;
}

/**
 * Destroys an E2E test environment
 * REQ-205: Environment cleanup
 */
export async function destroyE2EEnvironment(environment: E2EEnvironment): Promise<CleanupResult> {
  const cleaned: string[] = [];
  const errors: string[] = [];
  
  for (const cleanup of environment.cleanup) {
    try {
      await cleanup();
      cleaned.push(`Environment cleanup: ${environment.id}`);
    } catch (error) {
      errors.push(`Environment cleanup error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return {
    cleaned,
    errors,
    success: errors.length === 0
  };
}

/**
 * Monitors resource usage and warns about leaks
 * REQ-205: Resource leak detection
 */
export function checkResourceLeaks(): {
  readonly hasLeaks: boolean;
  readonly processCount: number;
  readonly tempDirCount: number;
  readonly tempFileCount: number;
  readonly warnings: readonly string[];
} {
  const warnings: string[] = [];
  
  if (activeProcesses.size > 0) {
    warnings.push(`${activeProcesses.size} processes still active`);
  }
  
  if (tempDirectories.size > 0) {
    warnings.push(`${tempDirectories.size} temp directories not cleaned`);
  }
  
  if (tempFiles.size > 0) {
    warnings.push(`${tempFiles.size} temp files not cleaned`);
  }
  
  return {
    hasLeaks: warnings.length > 0,
    processCount: activeProcesses.size,
    tempDirCount: tempDirectories.size,
    tempFileCount: tempFiles.size,
    warnings
  };
}

// Cleanup on process exit
process.on('exit', () => {
  // Synchronous cleanup only
  for (const pid of activeProcesses.keys()) {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      // Ignore errors during exit
    }
  }
});

process.on('SIGINT', async () => {
  await performCompleteCleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await performCompleteCleanup();
  process.exit(0);
});

/**
 * ProcessManager implementation for E2E testing
 * REQ-802: Fix E2E test infrastructure logic
 */
class ProcessManagerImpl implements ProcessManager {
  private processes = new Map<ProcessId, ChildProcess>();

  async spawn(
    command: string,
    args: readonly string[],
    options: ExecutionOptions = {}
  ): Promise<ProcessInfo> {
    const { timeout = 30000, cwd = process.cwd(), env = {} } = options;

    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!child.pid) {
        reject(new Error('Failed to spawn process'));
        return;
      }

      const pid = child.pid;
      const startTime = new Date();
      this.processes.set(pid, child);

      const info: ProcessInfo = {
        pid,
        command,
        args,
        startTime,
        status: 'running'
      };

      registerProcess(info);

      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          info.status = 'timeout';
        }, timeout);
      }

      child.on('exit', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        info.status = code === 0 ? 'completed' : 'failed';
        this.processes.delete(pid);
        unregisterProcess(pid);
      });

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        info.status = 'failed';
        this.processes.delete(pid);
        unregisterProcess(pid);
        reject(error);
      });

      resolve(info);
    });
  }

  async kill(processId: ProcessId): Promise<void> {
    const child = this.processes.get(processId);
    if (!child) {
      return; // Process not found or already terminated
    }

    return new Promise((resolve) => {
      child.on('exit', () => {
        this.processes.delete(processId);
        unregisterProcess(processId);
        resolve();
      });

      // Try graceful termination first
      child.kill('SIGTERM');

      // Force kill after 2 seconds if still running
      setTimeout(() => {
        if (this.processes.has(processId)) {
          child.kill('SIGKILL');
        }
      }, 2000);
    });
  }

  async killAll(): Promise<void> {
    const killPromises = Array.from(this.processes.keys()).map(pid =>
      this.kill(pid)
    );
    await Promise.all(killPromises);
  }

  getActiveProcesses(): ProcessId[] {
    return Array.from(this.processes.keys());
  }

  async isProcessActive(pid: ProcessId): Promise<boolean> {
    const child = this.processes.get(pid);
    if (!child) {
      return false;
    }

    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch {
      // Process doesn't exist, clean up our tracking
      this.processes.delete(pid);
      unregisterProcess(pid);
      return false;
    }
  }

  async handleError(errorType: string): Promise<{
    recovered: boolean;
    cleanup: boolean;
    resourcesReleased: boolean;
  }> {
    let recovered = false;
    let cleanup = false;
    let resourcesReleased = false;

    try {
      switch (errorType) {
        case 'permission_denied':
        case 'disk_full':
        case 'network_timeout':
        case 'invalid_config':
          // Clean up all processes and resources
          await this.killAll();
          await performCompleteCleanup();
          cleanup = true;
          resourcesReleased = true;
          recovered = true;
          break;

        default:
          // Generic error handling
          await this.killAll();
          await performCompleteCleanup();
          cleanup = true;
          resourcesReleased = true;
          recovered = true;
      }
    } catch (error) {
      // Error handling failed, but we tried
      recovered = false;
    }

    return { recovered, cleanup, resourcesReleased };
  }
}

/**
 * Factory function to create ProcessManager instance
 * REQ-802: Missing createProcessManager function
 */
export async function createProcessManager(): Promise<ProcessManager> {
  return new ProcessManagerImpl();
}