import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Import parameterized constants to replace hardcoded literals
import {
  MACOS_PATHS,
  MACOS_PERMISSIONS,
  TEST_ENV_VARS,
  MCP_SERVER_CONFIGS
} from "../utils/test-constants.js";

// Import minimal real environment utilities (will throw with TODO messages)
import {
  createRealClaudeDirectory,
  validateFilePermissions,
  testPackageInstallation,
  createTestSymlink,
  validateMcpServerInRealEnv,
  testEnvironmentVariables,
  cleanupRealEnvironment
} from "../utils/real-environment-helpers.js";

describe("REQ-005 — Real Environment Testing Infrastructure", () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = {
      homeDir: MACOS_PATHS.HOME_DIR,
      claudeDir: path.join(MACOS_PATHS.HOME_DIR, MACOS_PATHS.CLAUDE_CONFIG_DIR)
    };
  });

  afterEach(async () => {
    if (testEnv) {
      await cleanupRealEnvironment(testEnv);
    }
  });

  describe("Claude Directory Management", () => {
    test("REQ-005 — creates .claude directory with proper permissions on macOS", async () => {
      const claudeDir = path.join(testEnv.homeDir, MACOS_PATHS.CLAUDE_CONFIG_DIR);
      
      await createRealClaudeDirectory(testEnv.homeDir);
      
      // Validate directory creation and permissions
      await validateFilePermissions(claudeDir, MACOS_PERMISSIONS.EXECUTABLE);
      
      expect(fs.existsSync(claudeDir)).toBe(true);
      expect(fs.statSync(claudeDir).isDirectory()).toBe(true);
    });

    test("REQ-005 — handles existing .claude directory gracefully", async () => {
      const claudeDir = path.join(testEnv.homeDir, ".claude");
      const existingConfig = { existingProperty: "value" };
      
      // Pre-create directory with existing content
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, "claude_desktop_config.json"),
        JSON.stringify(existingConfig)
      );
      
      await testClaudeDirectoryCreation(claudeDir);
      
      // Should preserve existing content
      const config = JSON.parse(
        fs.readFileSync(path.join(claudeDir, "claude_desktop_config.json"), "utf8")
      );
      expect(config.existingProperty).toBe("value");
    });

    test("REQ-005 — creates nested configuration files", async () => {
      const claudeDir = path.join(testEnv.homeDir, ".claude");
      
      await testClaudeDirectoryCreation(claudeDir, {
        createSubdirs: ["agents", "templates", "logs"],
        createFiles: {
          "settings.json": { mode: "acceptEdits" },
          "agents/custom-agent.md": "# Custom Agent\n"
        }
      });
      
      expect(fs.existsSync(path.join(claudeDir, "agents"))).toBe(true);
      expect(fs.existsSync(path.join(claudeDir, "templates"))).toBe(true);
      expect(fs.existsSync(path.join(claudeDir, "logs"))).toBe(true);
      expect(fs.existsSync(path.join(claudeDir, "settings.json"))).toBe(true);
      expect(fs.existsSync(path.join(claudeDir, "agents", "custom-agent.md"))).toBe(true);
    });
  });

  describe("MCP Server Configuration", () => {
    test("REQ-005 — validates MCP server configurations in real filesystem", async () => {
      const mcpConfig = {
        github: {
          command: "npx",
          args: ["@modelcontextprotocol/server-github"],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: "test-token" }
        },
        filesystem: {
          command: "npx",
          args: ["@modelcontextprotocol/server-filesystem", testEnv.homeDir]
        }
      };

      const configPath = path.join(testEnv.claudeDir, "claude_desktop_config.json");
      const fullConfig = {
        mcpServers: mcpConfig,
        permissions: {
          allow: ["Read(**)"],
          deny: ["Read(*.env)"]
        }
      };

      fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2));

      const validation = await validateMacOSPermissions(configPath);
      
      expect(validation.isValid).toBe(true);
      expect(validation.mcpServers).toHaveLength(2);
      expect(validation.permissionsValid).toBe(true);
    });

    test("REQ-005 — tests filesystem MCP server with actual file operations", async () => {
      // Create test files in the environment
      const testFile = path.join(testEnv.homeDir, "test-document.md");
      fs.writeFileSync(testFile, "# Test Document\nThis is a test.");

      const mcpConfig = {
        filesystem: {
          command: "npx",
          args: ["@modelcontextprotocol/server-filesystem", testEnv.homeDir]
        }
      };

      const configPath = path.join(testEnv.claudeDir, "claude_desktop_config.json");
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: mcpConfig }));

      // Test that MCP server can access the file
      const serverValidation = await validateMacOSPermissions(configPath, {
        testFileAccess: testFile
      });

      expect(serverValidation.fileAccessible).toBe(true);
      expect(fs.existsSync(testFile)).toBe(true);
    });

    test("REQ-005 — validates npm package availability for MCP servers", async () => {
      const mcpConfig = {
        "non-existent-server": {
          command: "npx",
          args: ["@non-existent/mcp-server"]
        },
        github: {
          command: "npx", 
          args: ["@modelcontextprotocol/server-github"]
        }
      };

      const validation = await validateMacOSPermissions(testEnv.claudeDir, {
        validatePackageAvailability: true,
        mcpServers: mcpConfig
      });

      expect(validation.packageValidation).toBeDefined();
      expect(validation.packageValidation["non-existent-server"].available).toBe(false);
      // Note: github server might not be installed, but validation should handle this
    });
  });

  describe("Global vs Local Installation", () => {
    test("REQ-005 — tests global npm installation behavior on macOS", async () => {
      const installResult = await testGlobalInstallation(testEnv, {
        packageName: "claude-code-quickstart",
        simulateInstall: true
      });

      expect(installResult).toHaveProperty("globalPath");
      expect(installResult).toHaveProperty("binPath");
      expect(installResult).toHaveProperty("symlinkCreated");
      
      if (installResult.symlinkCreated) {
        expect(fs.existsSync(installResult.binPath)).toBe(true);
      }
    });

    test("REQ-005 — handles npm permission errors gracefully", async () => {
      const installResult = await testGlobalInstallation(testEnv, {
        packageName: "test-package",
        simulatePermissionError: true
      });

      expect(installResult).toHaveProperty("permissionError");
      expect(installResult.permissionError).toBe(true);
      expect(installResult).toHaveProperty("fallbackSuggestion");
      expect(installResult.fallbackSuggestion).toContain("sudo");
    });

    test("REQ-005 — validates local installation as fallback", async () => {
      const localInstall = await testGlobalInstallation(testEnv, {
        packageName: "claude-code-quickstart",
        useLocal: true
      });

      expect(localInstall).toHaveProperty("localPath");
      expect(localInstall.isGlobal).toBe(false);
      expect(path.isAbsolute(localInstall.localPath)).toBe(true);
    });
  });

  describe("Symlink Handling", () => {
    test("REQ-005 — creates and resolves symlinks correctly on macOS", async () => {
      const target = path.join(testEnv.homeDir, "target-file.txt");
      const link = path.join(testEnv.homeDir, "symlink.txt");
      
      fs.writeFileSync(target, "target content");
      
      const symlinkResult = await testSymlinkHandling({
        target,
        link,
        operation: "create"
      });

      expect(symlinkResult.created).toBe(true);
      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(link, "utf8")).toBe("target content");
    });

    test("REQ-005 — handles broken symlinks gracefully", async () => {
      const nonExistentTarget = path.join(testEnv.homeDir, "non-existent.txt");
      const link = path.join(testEnv.homeDir, "broken-link.txt");

      const symlinkResult = await testSymlinkHandling({
        target: nonExistentTarget,
        link,
        operation: "create"
      });

      expect(symlinkResult.created).toBe(true);
      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      
      const validation = await testSymlinkHandling({
        link,
        operation: "validate"
      });
      
      expect(validation.isBroken).toBe(true);
    });

    test("REQ-005 — resolves npm global symlinks correctly", async () => {
      const mockGlobalBin = path.join(testEnv.npmGlobalDir, "bin");
      const mockGlobalLib = path.join(testEnv.npmGlobalDir, "lib", "node_modules");
      
      fs.mkdirSync(mockGlobalBin, { recursive: true });
      fs.mkdirSync(mockGlobalLib, { recursive: true });

      const packagePath = path.join(mockGlobalLib, "claude-code-quickstart");
      const binScript = path.join(packagePath, "bin", "cli.js");
      const symlinkPath = path.join(mockGlobalBin, "claude-code-quickstart");

      fs.mkdirSync(path.dirname(binScript), { recursive: true });
      fs.writeFileSync(binScript, "#!/usr/bin/env node\nconsole.log('test');");
      fs.chmodSync(binScript, 0o755);

      const symlinkResult = await testSymlinkHandling({
        target: binScript,
        link: symlinkPath,
        operation: "create"
      });

      expect(symlinkResult.created).toBe(true);
      
      const resolution = await testSymlinkHandling({
        link: symlinkPath,
        operation: "resolve"
      });
      
      expect(resolution.resolvedPath).toBe(binScript);
    });
  });

  describe("macOS-Specific Behaviors", () => {
    test("REQ-005 — handles macOS ~/Library directory permissions", async () => {
      const libraryDir = path.join(testEnv.homeDir, "Library");
      fs.mkdirSync(libraryDir, { recursive: true });
      
      const claudeLibraryDir = path.join(libraryDir, "Application Support", "Claude");
      
      const permissionTest = await validateMacOSPermissions(claudeLibraryDir, {
        createIfNotExists: true,
        testWrite: true
      });

      expect(permissionTest.canWrite).toBe(true);
      expect(permissionTest.directoryExists).toBe(true);
    });

    test("REQ-005 — tests macOS sandboxing compatibility", async () => {
      // Test that our operations work within macOS sandbox restrictions
      const sandboxTest = await validateMacOSPermissions(testEnv.homeDir, {
        testSandboxRestrictions: true,
        operations: ["read", "write", "execute"]
      });

      expect(sandboxTest.readAllowed).toBe(true);
      expect(sandboxTest.writeAllowed).toBe(true);
      expect(sandboxTest).toHaveProperty("executionPolicy");
    });

    test("REQ-005 — validates Gatekeeper compatibility", async () => {
      const executablePath = path.join(testEnv.homeDir, "test-executable");
      fs.writeFileSync(executablePath, "#!/bin/bash\necho 'test'");
      fs.chmodSync(executablePath, 0o755);

      const gatekeeperTest = await validateMacOSPermissions(executablePath, {
        testGatekeeper: true
      });

      expect(gatekeeperTest).toHaveProperty("gatekeeperStatus");
      expect(gatekeeperTest).toHaveProperty("canExecute");
    });
  });
});