/**
 * REQ-704: Claude CLI Integration Verification Tests
 * Test comprehensive Claude CLI availability and MCP functionality verification
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { execSync } from "node:child_process";

// Import functions from the CLI (this will fail until implemented)
let detectClaudeCLI: any, verifyClaudeVersion: any, checkMCPSubcommand: any,
    validateClaudePermissions: any, testMCPAddCommand: any, getClaudeInstallationPath: any,
    verifyClaudeAuthentication: any, checkClaudeConfigAccess: any, validateMCPCompatibility: any,
    runClaudeHealthCheck: any, isVersionCompatible: any, testMCPWorkflow: any;

try {
  const cliModule = require("../../bin/cli.js");
  detectClaudeCLI = cliModule.detectClaudeCLI;
  verifyClaudeVersion = cliModule.verifyClaudeVersion;
  checkMCPSubcommand = cliModule.checkMCPSubcommand;
  validateClaudePermissions = cliModule.validateClaudePermissions;
  testMCPAddCommand = cliModule.testMCPAddCommand;
  getClaudeInstallationPath = cliModule.getClaudeInstallationPath;
  verifyClaudeAuthentication = cliModule.verifyClaudeAuthentication;
  checkClaudeConfigAccess = cliModule.checkClaudeConfigAccess;
  validateMCPCompatibility = cliModule.validateMCPCompatibility;
  runClaudeHealthCheck = cliModule.runClaudeHealthCheck;
  isVersionCompatible = cliModule.isVersionCompatible;
  testMCPWorkflow = cliModule.testMCPWorkflow;
} catch (error) {
  // Functions don't exist yet - we'll use mock implementations
  isVersionCompatible = (version: string, minVersion: string): boolean => {
    throw new Error("REQ-704 isVersionCompatible not implemented");
  };
  detectClaudeCLI = (): boolean => {
    throw new Error("REQ-704 detectClaudeCLI not implemented");
  };
  verifyClaudeVersion = (): any => {
    throw new Error("REQ-704 verifyClaudeVersion not implemented");
  };
  checkMCPSubcommand = (): boolean => {
    throw new Error("REQ-704 checkMCPSubcommand not implemented");
  };
  validateClaudePermissions = (): any => {
    throw new Error("REQ-704 validateClaudePermissions not implemented");
  };
  testMCPAddCommand = (config: any): any => {
    throw new Error("REQ-704 testMCPAddCommand not implemented");
  };
  getClaudeInstallationPath = (): string | null => {
    throw new Error("REQ-704 getClaudeInstallationPath not implemented");
  };
  verifyClaudeAuthentication = (): any => {
    throw new Error("REQ-704 verifyClaudeAuthentication not implemented");
  };
  checkClaudeConfigAccess = (): any => {
    throw new Error("REQ-704 checkClaudeConfigAccess not implemented");
  };
  validateMCPCompatibility = (): any => {
    throw new Error("REQ-704 validateMCPCompatibility not implemented");
  };
  runClaudeHealthCheck = (): any => {
    throw new Error("REQ-704 runClaudeHealthCheck not implemented");
  };
  testMCPWorkflow = (config: any): any => {
    throw new Error("REQ-704 testMCPWorkflow not implemented");
  };
}

describe("REQ-704 — Claude CLI Integration Verification", () => {
  describe("Claude Command Detection", () => {
    test("REQ-704 — detects claude command in PATH", () => {
      const isAvailable = detectClaudeCLI();

      expect(typeof isAvailable).toBe("boolean");

      if (isAvailable) {
        // If claude is available, it should be executable
        expect(() => {
          execSync("claude --version", { stdio: "pipe" });
        }).not.toThrow();
      }
    });

    test("REQ-704 — returns false when claude command not found", () => {
      // Test with modified PATH that excludes claude
      const originalPath = process.env.PATH;
      process.env.PATH = "/usr/bin:/bin"; // Basic PATH without claude

      const isAvailable = detectClaudeCLI();

      expect(isAvailable).toBe(false);

      // Restore original PATH
      process.env.PATH = originalPath;
    });

    test("REQ-704 — gets Claude installation path when available", () => {
      const claudePath = getClaudeInstallationPath();

      if (claudePath) {
        expect(typeof claudePath).toBe("string");
        expect(claudePath.length).toBeGreaterThan(0);
        expect(claudePath).toMatch(/claude/);
      } else {
        expect(claudePath).toBeNull();
      }
    });

    test("REQ-704 — property-based test for path detection consistency", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (fakePath) => {
            // Mock PATH with fake directory
            const originalPath = process.env.PATH;
            process.env.PATH = fakePath;

            try {
              const isAvailable = detectClaudeCLI();
              expect(typeof isAvailable).toBe("boolean");
            } finally {
              process.env.PATH = originalPath;
            }
          }
        )
      );
    });
  });

  describe("Claude Version Verification", () => {
    test("REQ-704 — verifies Claude version compatibility", () => {
      const versionInfo = verifyClaudeVersion();

      expect(versionInfo).toHaveProperty("version");
      expect(versionInfo).toHaveProperty("compatible");
      expect(versionInfo).toHaveProperty("minVersion");

      if (versionInfo.version) {
        expect(typeof versionInfo.version).toBe("string");
        expect(versionInfo.version).toMatch(/\d+\.\d+\.\d+/);
      }

      expect(typeof versionInfo.compatible).toBe("boolean");
      expect(typeof versionInfo.minVersion).toBe("string");
    });

    test("REQ-704 — validates minimum version requirements", () => {
      const minVersion = "1.0.0";
      const testVersions = [
        { version: "0.9.9", expected: false },
        { version: "1.0.0", expected: true },
        { version: "1.0.1", expected: true },
        { version: "2.0.0", expected: true }
      ];

      testVersions.forEach(({ version, expected }) => {
        const isCompatible = isVersionCompatible(version, minVersion);
        expect(isCompatible).toBe(expected);
      });
    });

    test("REQ-704 — handles invalid version formats gracefully", () => {
      const invalidVersions = [
        "",
        "invalid",
        "1.0",
        "v1.0.0",
        "1.0.0-beta",
        null,
        undefined
      ];

      invalidVersions.forEach(version => {
        expect(() => {
          isVersionCompatible(version, "1.0.0");
        }).not.toThrow();
      });
    });
  });

  describe("MCP Subcommand Verification", () => {
    test("REQ-704 — verifies claude mcp add command exists", () => {
      const mcpAvailable = checkMCPSubcommand();

      expect(typeof mcpAvailable).toBe("boolean");

      if (mcpAvailable) {
        // Should be able to get help for mcp add command
        expect(() => {
          execSync("claude mcp add --help", { stdio: "pipe" });
        }).not.toThrow();
      }
    });

    test("REQ-704 — verifies MCP command compatibility", () => {
      const compatibility = validateMCPCompatibility();

      expect(compatibility).toHaveProperty("mcpAvailable");
      expect(compatibility).toHaveProperty("addCommandAvailable");
      expect(compatibility).toHaveProperty("scopeSupported");
      expect(compatibility).toHaveProperty("transportSupported");

      expect(typeof compatibility.mcpAvailable).toBe("boolean");
      expect(typeof compatibility.addCommandAvailable).toBe("boolean");
      expect(typeof compatibility.scopeSupported).toBe("boolean");
      expect(typeof compatibility.transportSupported).toBe("boolean");
    });

    test("REQ-704 — tests MCP add command with dry run", () => {
      const testResult = testMCPAddCommand({
        key: "test-server",
        url: "https://test.example.com",
        scope: "user",
        dryRun: true
      });

      expect(testResult).toHaveProperty("success");
      expect(testResult).toHaveProperty("command");
      expect(testResult).toHaveProperty("error");

      if (testResult.success) {
        expect(testResult.command).toContain("claude mcp add");
        expect(testResult.command).toContain("test-server");
        expect(testResult.error).toBeNull();
      } else {
        expect(testResult.error).toBeDefined();
      }
    });

    test("REQ-704 — property-based test for MCP command structure", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            url: fc.webUrl(),
            scope: fc.constantFrom("user", "project", "local")
          }),
          (config) => {
            const testResult = testMCPAddCommand({
              ...config,
              dryRun: true
            });

            expect(testResult).toHaveProperty("success");
            expect(testResult).toHaveProperty("command");

            if (testResult.success && testResult.command) {
              expect(testResult.command).toContain("claude");
              expect(testResult.command).toContain("mcp");
              expect(testResult.command).toContain("add");
              expect(testResult.command).toContain(config.key);
              expect(testResult.command).toContain(config.scope);
            }
          }
        )
      );
    });
  });

  describe("Claude Permissions and Authentication", () => {
    test("REQ-704 — validates Claude configuration access", () => {
      const configAccess = checkClaudeConfigAccess();

      expect(configAccess).toHaveProperty("canRead");
      expect(configAccess).toHaveProperty("canWrite");
      expect(configAccess).toHaveProperty("configPath");
      expect(configAccess).toHaveProperty("error");

      expect(typeof configAccess.canRead).toBe("boolean");
      expect(typeof configAccess.canWrite).toBe("boolean");

      if (configAccess.configPath) {
        expect(typeof configAccess.configPath).toBe("string");
        expect(configAccess.configPath).toMatch(/\.claude/);
      }
    });

    test("REQ-704 — verifies Claude authentication status", () => {
      const authStatus = verifyClaudeAuthentication();

      expect(authStatus).toHaveProperty("authenticated");
      expect(authStatus).toHaveProperty("user");
      expect(authStatus).toHaveProperty("permissions");

      expect(typeof authStatus.authenticated).toBe("boolean");

      if (authStatus.authenticated) {
        expect(authStatus.user).toBeDefined();
        expect(Array.isArray(authStatus.permissions)).toBe(true);
      }
    });

    test("REQ-704 — validates required permissions for MCP operations", () => {
      const permissions = validateClaudePermissions();

      expect(permissions).toHaveProperty("canAddServers");
      expect(permissions).toHaveProperty("canModifyConfig");
      expect(permissions).toHaveProperty("canAccessMCP");
      expect(permissions).toHaveProperty("missingPermissions");

      expect(typeof permissions.canAddServers).toBe("boolean");
      expect(typeof permissions.canModifyConfig).toBe("boolean");
      expect(typeof permissions.canAccessMCP).toBe("boolean");
      expect(Array.isArray(permissions.missingPermissions)).toBe(true);
    });

    test("REQ-704 — handles permission errors gracefully", () => {
      // Test with restricted permissions (if possible)
      expect(() => {
        validateClaudePermissions();
      }).not.toThrow();
    });
  });

  describe("Claude Health Check", () => {
    test("REQ-704 — runs comprehensive Claude health check", () => {
      const healthCheck = runClaudeHealthCheck();

      expect(healthCheck).toHaveProperty("overall");
      expect(healthCheck).toHaveProperty("cli");
      expect(healthCheck).toHaveProperty("version");
      expect(healthCheck).toHaveProperty("mcp");
      expect(healthCheck).toHaveProperty("auth");
      expect(healthCheck).toHaveProperty("config");
      expect(healthCheck).toHaveProperty("recommendations");

      expect(typeof healthCheck.overall).toBe("string");
      expect(["healthy", "warning", "error"]).toContain(healthCheck.overall);

      expect(Array.isArray(healthCheck.recommendations)).toBe(true);
    });

    test("REQ-704 — provides actionable recommendations for issues", () => {
      const healthCheck = runClaudeHealthCheck();

      if (healthCheck.overall !== "healthy") {
        expect(healthCheck.recommendations.length).toBeGreaterThan(0);

        healthCheck.recommendations.forEach(recommendation => {
          expect(typeof recommendation).toBe("string");
          expect(recommendation.length).toBeGreaterThan(10);
          expect(recommendation).toMatch(/install|update|configure|check|verify/i);
        });
      }
    });

    test("REQ-704 — generates detailed diagnostic information", () => {
      const healthCheck = runClaudeHealthCheck();

      // Each check should have status and details
      const checks = ["cli", "version", "mcp", "auth", "config"];

      checks.forEach(checkName => {
        const check = healthCheck[checkName];
        expect(check).toHaveProperty("status");
        expect(check).toHaveProperty("details");

        expect(["pass", "warning", "fail"]).toContain(check.status);
        expect(typeof check.details).toBe("string");
      });
    });
  });

  describe("Integration Workflow Testing", () => {
    test("REQ-704 — tests complete MCP server addition workflow", () => {
      const workflowResult = testMCPWorkflow({
        serverKey: "test-integration",
        serverUrl: "https://test.example.com/mcp",
        scope: "user",
        dryRun: true
      });

      expect(workflowResult).toHaveProperty("steps");
      expect(workflowResult).toHaveProperty("success");
      expect(workflowResult).toHaveProperty("errors");

      expect(Array.isArray(workflowResult.steps)).toBe(true);
      expect(typeof workflowResult.success).toBe("boolean");
      expect(Array.isArray(workflowResult.errors)).toBe(true);

      // Should have steps for detection, verification, and command execution
      const stepNames = workflowResult.steps.map(step => step.name);
      expect(stepNames).toContain("detection");
      expect(stepNames).toContain("verification");
      expect(stepNames).toContain("command");
    });

    test("REQ-704 — handles Claude CLI unavailability gracefully", () => {
      // Mock claude command as unavailable
      const originalExecSync = execSync;
      const mockExecSync = () => {
        throw new Error("Command not found: claude");
      };

      try {
        // Replace execSync temporarily
        Object.defineProperty(require("child_process"), "execSync", {
          value: mockExecSync,
          writable: true
        });

        const workflowResult = testMCPWorkflow({
          serverKey: "test-unavailable",
          serverUrl: "https://test.example.com/mcp",
          scope: "user",
          dryRun: true
        });

        expect(workflowResult.success).toBe(false);
        expect(workflowResult.errors.length).toBeGreaterThan(0);
        expect(workflowResult.errors[0]).toContain("claude");
      } finally {
        // Restore original execSync
        Object.defineProperty(require("child_process"), "execSync", {
          value: originalExecSync,
          writable: true
        });
      }
    });
  });
});

// All functions are now imported/mocked above in the try-catch block