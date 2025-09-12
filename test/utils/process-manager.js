/**
 * Process Management Module - Resource cleanup and lifecycle management
 * REQ-205: Resource Management - Proper cleanup and error handling
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
// Resource tracking
const activeProcesses = new Map();
const tempDirectories = new Set();
const tempFiles = new Set();
const cleanupCallbacks = new Set();
// Resource limits
const RESOURCE_LIMITS = {
    MAX_PROCESSES: 10,
    MAX_TEMP_DIRS: 20,
    MAX_TEMP_FILES: 100,
    CLEANUP_TIMEOUT_MS: 5000,
    PROCESS_KILL_TIMEOUT_MS: 2000
};
/**
 * Registers a process for tracking and cleanup
 * REQ-205: Process lifecycle management
 */
export function registerProcess(processInfo) {
    if (activeProcesses.size >= RESOURCE_LIMITS.MAX_PROCESSES) {
        throw new Error(`Maximum number of processes (${RESOURCE_LIMITS.MAX_PROCESSES}) exceeded`);
    }
    activeProcesses.set(processInfo.pid, processInfo);
}
/**
 * Unregisters a process from tracking
 * REQ-205: Process cleanup
 */
export function unregisterProcess(pid) {
    activeProcesses.delete(pid);
}
/**
 * Gets all active processes
 * REQ-205: Process monitoring
 */
export function getActiveProcesses() {
    return Array.from(activeProcesses.values());
}
/**
 * Kills a process gracefully with fallback to force kill
 * REQ-205: Graceful process termination
 */
export async function killProcess(pid) {
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
        }
        catch {
            // Process no longer exists (graceful shutdown succeeded)
        }
        unregisterProcess(pid);
        return true;
    }
    catch (error) {
        // Process might already be dead
        unregisterProcess(pid);
        return false;
    }
}
/**
 * Kills all active processes
 * REQ-205: Cleanup all processes
 */
export async function killAllProcesses() {
    const cleaned = [];
    const errors = [];
    const processIds = Array.from(activeProcesses.keys());
    for (const pid of processIds) {
        try {
            const success = await killProcess(pid);
            if (success) {
                cleaned.push(`Process ${pid}`);
            }
            else {
                errors.push(`Failed to kill process ${pid}`);
            }
        }
        catch (error) {
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
export async function createTempDirectory(prefix = 'claude-test-') {
    if (tempDirectories.size >= RESOURCE_LIMITS.MAX_TEMP_DIRS) {
        throw new Error(`Maximum number of temp directories (${RESOURCE_LIMITS.MAX_TEMP_DIRS}) exceeded`);
    }
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirectories.add(tempDir);
    return tempDir;
}
/**
 * Creates a temporary file with tracking
 * REQ-205: Temporary file management
 */
export async function createTempFile(content = '', extension = '.tmp') {
    if (tempFiles.size >= RESOURCE_LIMITS.MAX_TEMP_FILES) {
        throw new Error(`Maximum number of temp files (${RESOURCE_LIMITS.MAX_TEMP_FILES}) exceeded`);
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
export async function removeTempDirectory(dirPath) {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
        tempDirectories.delete(dirPath);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Removes a temporary file
 * REQ-205: File cleanup
 */
export async function removeTempFile(filePath) {
    try {
        await fs.unlink(filePath);
        tempFiles.delete(filePath);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Cleans up all temporary directories
 * REQ-205: Complete directory cleanup
 */
export async function cleanupAllTempDirectories() {
    const cleaned = [];
    const errors = [];
    for (const dir of tempDirectories) {
        const success = await removeTempDirectory(dir);
        if (success) {
            cleaned.push(`Directory: ${dir}`);
        }
        else {
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
export async function cleanupAllTempFiles() {
    const cleaned = [];
    const errors = [];
    for (const file of tempFiles) {
        const success = await removeTempFile(file);
        if (success) {
            cleaned.push(`File: ${file}`);
        }
        else {
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
export function registerCleanupCallback(callback) {
    cleanupCallbacks.add(callback);
}
/**
 * Executes all cleanup callbacks
 * REQ-205: Execute custom cleanup
 */
export async function executeCleanupCallbacks() {
    const cleaned = [];
    const errors = [];
    for (const callback of cleanupCallbacks) {
        try {
            await callback();
            cleaned.push('Custom cleanup callback');
        }
        catch (error) {
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
export async function performCompleteCleanup() {
    const allCleaned = [];
    const allErrors = [];
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
export async function createE2EEnvironment(prefix = 'e2e-') {
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
    const environment = {
        id: `env-${Date.now()}`,
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
export async function destroyE2EEnvironment(environment) {
    const cleaned = [];
    const errors = [];
    for (const cleanup of environment.cleanup) {
        try {
            await cleanup();
            cleaned.push(`Environment cleanup: ${environment.id}`);
        }
        catch (error) {
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
export function checkResourceLeaks() {
    const warnings = [];
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
        }
        catch {
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
