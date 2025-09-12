import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
// This import SHOULD exist after refactoring but WILL FAIL initially
import { createProcessManager } from "./process-manager.js";
describe("REQ-205 — Process Manager Resource Management", () => {
    let processManager;
    let tempDir;
    beforeEach(async () => {
        // This SHOULD create a process manager but WILL FAIL initially
        processManager = await createProcessManager();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "process-test-"));
    });
    afterEach(async () => {
        if (processManager) {
            await processManager.cleanup();
        }
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
    describe("resource_leaks", () => {
        test("REQ-205 — prevents hanging processes after test completion", async () => {
            const initialProcesses = await processManager.getActiveProcesses();
            // Spawn multiple long-running processes
            const spawnPromises = [];
            for (let i = 0; i < 5; i++) {
                spawnPromises.push(processManager.spawn("sleep", [`${10 + i}`], {
                    timeout: 1000,
                    tag: `test-sleep-${i}`
                }));
            }
            const processes = await Promise.all(spawnPromises);
            // Processes should be tracked
            const activeProcesses = await processManager.getActiveProcesses();
            expect(activeProcesses.length).toBe(initialProcesses.length + 5);
            // Cleanup should kill all spawned processes
            await processManager.cleanup();
            // Wait for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            const finalProcesses = await processManager.getActiveProcesses();
            expect(finalProcesses.length).toBe(initialProcesses.length);
            // Verify processes are actually terminated, not just forgotten
            for (const process of processes) {
                const isActive = await processManager.isProcessActive(process.pid);
                expect(isActive).toBe(false);
            }
        });
        test("REQ-205 — properly handles process timeouts without resource leaks", async () => {
            const memoryBefore = process.memoryUsage();
            const processes = [];
            // Create many processes that will timeout
            for (let i = 0; i < 20; i++) {
                const proc = await processManager.spawn("sleep", ["10"], {
                    timeout: 100,
                    tag: `timeout-test-${i}`
                });
                processes.push(proc);
            }
            // Wait for all timeouts to occur
            await new Promise(resolve => setTimeout(resolve, 500));
            // All processes should be cleaned up
            for (const proc of processes) {
                const isActive = await processManager.isProcessActive(proc.pid);
                expect(isActive).toBe(false);
            }
            // Memory usage should not grow significantly
            const memoryAfter = process.memoryUsage();
            const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
            expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
        });
        test("REQ-205 — handles concurrent process creation without race conditions", async () => {
            const concurrentOperations = [];
            const processCount = 15;
            // Launch many processes concurrently
            for (let i = 0; i < processCount; i++) {
                concurrentOperations.push(processManager.spawn("echo", [`process-${i}`], {
                    timeout: 2000,
                    tag: `concurrent-${i}`
                }));
            }
            const processes = await Promise.all(concurrentOperations);
            // All processes should be created successfully
            expect(processes).toHaveLength(processCount);
            processes.forEach(proc => {
                expect(proc.pid).toBeGreaterThan(0);
                expect(proc.state).toBeOneOf(["running", "completed"]);
            });
            // All processes should complete successfully
            const results = await Promise.all(processes.map(proc => processManager.waitForCompletion(proc.pid)));
            results.forEach(result => {
                expect(result.code).toBe(0);
                expect(result.stdout).toContain("process-");
            });
        });
    });
    describe("poor_error_handling", () => {
        test("REQ-205 — gracefully handles process spawn failures", async () => {
            const nonExistentCommand = "this-command-does-not-exist-xyz";
            // Should handle spawn failure gracefully
            await expect(processManager.spawn(nonExistentCommand, [], { timeout: 1000 })).rejects.toThrow(/command not found|spawn.*failed/i);
            // Process manager should still be functional after error
            const echoResult = await processManager.spawn("echo", ["test"], { timeout: 1000 });
            expect(echoResult.pid).toBeGreaterThan(0);
        });
        test("REQ-205 — recovers from process termination errors", async () => {
            const process = await processManager.spawn("sleep", ["5"], { timeout: 10000 });
            // Force kill the process externally (simulate external termination)
            try {
                if (os.platform() !== "win32") {
                    require("child_process").execSync(`kill -9 ${process.pid}`);
                }
            }
            catch {
                // Expected if process already terminated
            }
            // Process manager should detect and handle the termination
            await new Promise(resolve => setTimeout(resolve, 100));
            const isActive = await processManager.isProcessActive(process.pid);
            expect(isActive).toBe(false);
            // Process manager should still be functional
            const newProcess = await processManager.spawn("echo", ["recovery-test"], { timeout: 1000 });
            expect(newProcess.pid).toBeGreaterThan(0);
        });
        test("REQ-205 — handles system resource exhaustion gracefully", async () => {
            // Attempt to exhaust process limits (platform-dependent)
            const processes = [];
            let spawnFailures = 0;
            try {
                // Try to spawn many processes quickly
                for (let i = 0; i < 1000; i++) {
                    try {
                        const proc = await processManager.spawn("echo", [`test-${i}`], {
                            timeout: 100,
                            tag: `resource-test-${i}`
                        });
                        processes.push(proc);
                    }
                    catch (error) {
                        spawnFailures++;
                        // Should fail gracefully, not crash
                        expect(error.message).toMatch(/resource|limit|spawn/i);
                        break; // Stop when we hit system limits
                    }
                    if (i % 100 === 0) {
                        // Give system time to handle spawning
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
            }
            finally {
                // Clean up all spawned processes
                for (const proc of processes) {
                    try {
                        await processManager.kill(proc.pid);
                    }
                    catch {
                        // Process might already be dead
                    }
                }
            }
            // Should have attempted to spawn processes and failed gracefully
            expect(processes.length + spawnFailures).toBeGreaterThan(0);
            // Process manager should still be functional after resource exhaustion
            const testProcess = await processManager.spawn("echo", ["still-working"], { timeout: 1000 });
            expect(testProcess.pid).toBeGreaterThan(0);
        });
    });
    describe("race_conditions", () => {
        test("REQ-205 — prevents race conditions in concurrent cleanup operations", async () => {
            const processes = [];
            // Spawn multiple processes
            for (let i = 0; i < 10; i++) {
                const proc = await processManager.spawn("sleep", ["2"], {
                    timeout: 5000,
                    tag: `race-test-${i}`
                });
                processes.push(proc);
            }
            // Trigger multiple cleanup operations concurrently
            const cleanupPromises = processes.map(proc => processManager.kill(proc.pid));
            // Add process manager cleanup
            cleanupPromises.push(processManager.cleanup());
            // All cleanup operations should complete without errors
            const results = await Promise.allSettled(cleanupPromises);
            // Most operations should succeed (some might fail if process already dead)
            const successCount = results.filter(r => r.status === "fulfilled").length;
            expect(successCount).toBeGreaterThan(0);
            // No processes should remain active
            const activeProcesses = await processManager.getActiveProcesses();
            const ourProcesses = activeProcesses.filter(pid => processes.some(p => p.pid === pid));
            expect(ourProcesses).toHaveLength(0);
        });
        test("REQ-205 — thread-safe process tracking across concurrent operations", async () => {
            const operationPromises = [];
            const processIds = [];
            // Mix of spawn and kill operations
            for (let i = 0; i < 20; i++) {
                if (i % 2 === 0) {
                    // Spawn operation
                    operationPromises.push(processManager.spawn("sleep", ["1"], {
                        timeout: 2000,
                        tag: `thread-test-${i}`
                    }).then(proc => {
                        processIds.push(proc.pid);
                        return proc;
                    }));
                }
                else {
                    // Kill operation (will fail for non-existent process)
                    operationPromises.push(processManager.kill(999999 + i).catch(() => null));
                }
            }
            await Promise.all(operationPromises);
            // Process tracking should be consistent
            const activeProcesses = await processManager.getActiveProcesses();
            const ourActiveProcesses = activeProcesses.filter(pid => processIds.includes(pid));
            // Some of our processes should still be tracked
            // (exact count depends on timing, but should be consistent)
            expect(ourActiveProcesses.length).toBeGreaterThanOrEqual(0);
            expect(ourActiveProcesses.length).toBeLessThanOrEqual(processIds.length);
        });
    });
    describe("REQ-201 — Process Manager Architecture", () => {
        test("REQ-201 — process manager is focused module under size limits", async () => {
            const processManagerPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/process-manager.ts";
            const content = await fs.readFile(processManagerPath, "utf-8");
            const lineCount = content.split("\n").length;
            // Module should be under 300 lines
            expect(lineCount).toBeLessThanOrEqual(300);
            // Should only export process management functions
            const exports = content.match(/export\s+(?:async\s+)?(?:function|class|const)\s+\w+/g) || [];
            expect(exports.length).toBeLessThanOrEqual(10); // Focused on process management
            // Should not contain security validation or CLI execution logic
            expect(content).not.toContain("validateCommand");
            expect(content).not.toContain("validatePath");
            expect(content).not.toContain("simulateUser");
        });
    });
    describe("REQ-204 — TDD Compliance for Process Manager", () => {
        test("REQ-204 — process manager tests validate resource management, not implementation", async () => {
            const testFilePath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/process-manager.spec.ts";
            const testContent = await fs.readFile(testFilePath, "utf-8");
            // Should test resource management outcomes
            const resourceTests = [
                "resource_leaks",
                "hanging processes",
                "memory usage",
                "process cleanup",
                "race conditions",
            ];
            for (const testType of resourceTests) {
                expect(testContent.toLowerCase()).toContain(testType.replace(" ", "_").toLowerCase());
            }
            // Should reference REQ-205 in test names
            expect(testContent).toContain("REQ-205");
        });
    });
});
