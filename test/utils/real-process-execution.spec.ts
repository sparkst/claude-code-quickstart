/**
 * Real Process Execution Tests - TDD for removing simulation and implementing real execution
 * REQ-503: Real Process Execution vs Simulation
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// These imports should reference REAL execution functions, not simulation
let executeRealCliCommand: (command: string, args: string[], options?: any) => Promise<any>;
let createRealProcessManager: () => any;
let simulateCliExecution: any; // This should NOT exist in the real implementation
let simulateFirstTimeUser: any; // This should NOT exist in the real implementation

try {
  const realModule = await import("./process-manager.js");
  createRealProcessManager = realModule.createProcessManager;

  // Import real CLI execution functions
  const cliModule = await import("./cli-executor.js");
  executeRealCliCommand = cliModule.executeCliCommand;

  // These simulation functions should NOT exist after REQ-503 implementation
  // If e2e-helpers.js exists, we haven't completed the migration
  try {
    const legacyModule = await import("./e2e-helpers.js");
    simulateCliExecution = legacyModule.simulateCliExecution;
    simulateFirstTimeUser = legacyModule.simulateFirstTimeUser;
  } catch {
    // Good! Legacy simulation file has been removed
    simulateCliExecution = undefined;
    simulateFirstTimeUser = undefined;
  }
} catch (error) {
  // Functions don't exist yet - this is expected for TDD
  executeRealCliCommand = async () => {
    throw new Error("executeRealCliCommand function not implemented yet - REQ-503");
  };
  createRealProcessManager = () => {
    throw new Error("createRealProcessManager function not implemented yet - REQ-503");
  };
}

describe("REQ-503 — Real Process Execution vs Simulation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "real-exec-test-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("executeRealCliCommand", () => {
    test("REQ-503 — executeRealCliCommand function exists and executes real subprocess", async () => {
      // This SHOULD pass after implementation but WILL FAIL initially
      expect(executeRealCliCommand).toBeDefined();
      expect(typeof executeRealCliCommand).toBe("function");

      const result = await executeRealCliCommand("echo", ["real-test"], {
        cwd: tempDir,
        timeout: 5000
      });

      // Should return real process execution results
      expect(result.stdout.trim()).toBe("real-test");
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test("REQ-503 — executeRealCliCommand creates real filesystem changes", async () => {
      const testFile = path.join(tempDir, "real-file.txt");
      const testContent = "Real file content created by subprocess";

      await executeRealCliCommand("sh", ["-c", `echo "${testContent}" > "${testFile}"`], {
        cwd: tempDir,
        timeout: 5000
      });

      // Verify real file was created by the subprocess
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const actualContent = await fs.readFile(testFile, "utf-8");
      expect(actualContent.trim()).toBe(testContent);
    });

    test("REQ-503 — executeRealCliCommand handles real command failures", async () => {
      const result = await executeRealCliCommand("false", [], {
        timeout: 5000
      });

      // Should get real exit code from failed command
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeDefined();
    });

    test("REQ-503 — executeRealCliCommand respects working directory changes", async () => {
      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir);

      const result = await executeRealCliCommand("pwd", [], {
        cwd: subDir,
        timeout: 5000
      });

      expect(result.stdout.trim()).toBe(subDir);
    });

    test("REQ-503 — executeRealCliCommand passes environment variables to subprocess", async () => {
      const testVar = "REAL_TEST_VAR";
      const testValue = "real-env-value-12345";

      const result = await executeRealCliCommand("sh", ["-c", `echo $${testVar}`], {
        env: { [testVar]: testValue },
        timeout: 5000
      });

      expect(result.stdout.trim()).toBe(testValue);
    });
  });

  describe("createRealProcessManager", () => {
    test("REQ-503 — createRealProcessManager function exists and manages real processes", () => {
      expect(createRealProcessManager).toBeDefined();
      expect(typeof createRealProcessManager).toBe("function");

      const processManager = createRealProcessManager();
      expect(processManager).toBeDefined();
      expect(typeof processManager.spawn).toBe("function");
      expect(typeof processManager.kill).toBe("function");
      expect(typeof processManager.killAll).toBe("function");
    });

    test("REQ-503 — createRealProcessManager spawns and tracks real processes", async () => {
      const processManager = createRealProcessManager();

      const processInfo = await processManager.spawn("sleep", ["2"], {
        timeout: 5000
      });

      expect(processInfo.pid).toBeTypeOf("number");
      expect(processInfo.pid).toBeGreaterThan(0);
      expect(processInfo.command).toBe("sleep");
      expect(processInfo.args).toEqual(["2"]);
      expect(processInfo.status).toBe("running");

      // Clean up
      await processManager.kill(processInfo.pid);
    });

    test("REQ-503 — createRealProcessManager kills real processes by PID", async () => {
      const processManager = createRealProcessManager();

      const processInfo = await processManager.spawn("sleep", ["10"], {
        timeout: 15000
      });

      expect(processInfo.status).toBe("running");

      await processManager.kill(processInfo.pid);

      // Process should be terminated
      const processes = processManager.getRunningProcesses();
      const stillRunning = processes.find(p => p.pid === processInfo.pid);
      expect(stillRunning).toBeUndefined();
    });

    test("REQ-503 — createRealProcessManager killAll terminates all tracked processes", async () => {
      const processManager = createRealProcessManager();

      // Spawn multiple real processes
      const process1 = await processManager.spawn("sleep", ["10"], { timeout: 15000 });
      const process2 = await processManager.spawn("sleep", ["10"], { timeout: 15000 });

      expect(processManager.getRunningProcesses()).toHaveLength(2);

      await processManager.killAll();

      // All processes should be terminated
      expect(processManager.getRunningProcesses()).toHaveLength(0);
    });
  });

  describe("Simulation Removal", () => {
    test("REQ-503 — simulateCliExecution function should NOT exist after real implementation", () => {
      // This test SHOULD PASS after REQ-503 implementation (simulation removed)
      // but WILL FAIL initially (simulation still exists)
      expect(simulateCliExecution).toBeUndefined();
    });

    test("REQ-503 — simulateFirstTimeUser function should NOT exist after real implementation", () => {
      // This test SHOULD PASS after REQ-503 implementation (simulation removed)
      // but WILL FAIL initially (simulation still exists)
      expect(simulateFirstTimeUser).toBeUndefined();
    });

    test("REQ-503 — e2e-helpers.js should not contain simulation code after migration", async () => {
      try {
        const helpersPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/e2e-helpers.js";
        const content = await fs.readFile(helpersPath, "utf-8");

        // After REQ-503, these simulation patterns should not exist
        expect(content).not.toContain("simulateCliExecution");
        expect(content).not.toContain("simulateFirstTimeUser");
        expect(content).not.toContain("hardcodedResponse");
        expect(content).not.toContain("mockResponse");
        expect(content).not.toContain("fakeExecution");
      } catch (error) {
        // File might not exist if fully migrated - that's acceptable
        expect(error.code).toBe("ENOENT");
      }
    });
  });

  describe("Real CLI Behavior Integration", () => {
    test("REQ-503 — real CLI execution produces actual npm package validation", async () => {
      const result = await executeRealCliCommand("npm", ["--version"], {
        timeout: 10000
      });

      // Should get real npm version, not simulation
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/); // Version format
      expect(result.stdout).not.toContain("simulated");
      expect(result.stdout).not.toContain("mock");
    });

    test("REQ-503 — real CLI execution validates actual Node.js environment", async () => {
      const result = await executeRealCliCommand("node", ["--version"], {
        timeout: 10000
      });

      // Should get real Node.js version
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
      expect(result.stdout).not.toContain("simulated");
    });

    test("REQ-503 — real CLI execution handles actual package.json operations", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const packageContent = {
        name: "test-package",
        version: "1.0.0",
        description: "Real package for testing"
      };

      await fs.writeFile(packageJsonPath, JSON.stringify(packageContent, null, 2));

      const result = await executeRealCliCommand("npm", ["ls", "--json"], {
        cwd: tempDir,
        timeout: 10000
      });

      // Should process real package.json
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.name).toBe("test-package");
      expect(output.version).toBe("1.0.0");
    });
  });
});