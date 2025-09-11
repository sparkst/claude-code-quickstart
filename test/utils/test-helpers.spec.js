import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Import parameterized constants to replace hardcoded literals
import {
  MACOS_PATHS,
  MCP_SERVER_CONFIGS,
  TEST_DATA,
  MACOS_PERMISSIONS,
  TEST_PREFIX
} from "./test-constants.js";

// Import minimal utility implementations (will throw with TODO messages)
import {
  createTempDirectory,
  cleanupTempDirectory,
  createMockMcpServer,
  generateTestConfig,
  createMacOSTestPaths,
  validateMcpServerConfig,
  setupTestEnvironment,
  teardownTestEnvironment
} from "./test-helpers.js";

describe("REQ-008 — Test Utilities and Helpers", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDirectory(MACOS_PATHS.TEMP_DIR_PREFIX);
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDirectory(tempDir);
    }
  });

  describe("createTempDirectory", () => {
    test("REQ-008 — creates unique temp directory with prefix", async () => {
      const dir = await createTempDirectory(TEST_PREFIX);
      
      expect(fs.existsSync(dir)).toBe(true);
      expect(path.basename(dir)).toMatch(new RegExp(`^${TEST_PREFIX}-`));
      expect(fs.statSync(dir).isDirectory()).toBe(true);
      
      await cleanupTempDirectory(dir);
    });

    test("REQ-008 — creates nested directory structure when needed", async () => {
      const dir = await createTempDirectory("nested", { 
        createSubdirs: [".claude", "node_modules", "src"] 
      });
      
      expect(fs.existsSync(path.join(dir, ".claude"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "node_modules"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "src"))).toBe(true);
      
      await cleanupTempDirectory(dir);
    });
  });

  describe("createMockMcpServer", () => {
    test("REQ-008 — generates valid MCP server configuration", () => {
      const serverConfig = createMockMcpServer("test-server", {
        command: "npx",
        args: ["@test/mcp-server"],
        env: { TEST_VAR: "value" }
      });

      expect(serverConfig).toHaveProperty("command", "npx");
      expect(serverConfig).toHaveProperty("args");
      expect(serverConfig.args).toContain("@test/mcp-server");
      expect(serverConfig).toHaveProperty("env");
      expect(serverConfig.env.TEST_VAR).toBe("value");
    });

    test("REQ-008 — creates server config with realistic defaults", () => {
      const serverConfig = createMockMcpServer("github");

      expect(serverConfig).toHaveProperty("command");
      expect(serverConfig).toHaveProperty("args");
      expect(Array.isArray(serverConfig.args)).toBe(true);
    });
  });

  describe("generateTestConfig", () => {
    test("REQ-008 — creates complete Claude config with MCP servers", () => {
      const config = generateTestConfig({
        servers: ["github", "filesystem", "sqlite"],
        permissions: { customRule: "allow" }
      });

      expect(config).toHaveProperty("mcpServers");
      expect(Object.keys(config.mcpServers)).toHaveLength(3);
      expect(config.mcpServers.github).toBeDefined();
      expect(config.mcpServers.filesystem).toBeDefined();
      expect(config.mcpServers.sqlite).toBeDefined();
      expect(config).toHaveProperty("permissions");
    });

    test("REQ-008 — generates config with default security permissions", () => {
      const config = generateTestConfig();

      expect(config.permissions.deny).toContain("Read(*.env)");
      expect(config.permissions.deny).toContain("Read(**/*.key)");
      expect(config.permissions.allow).toContain("Read(/**)");
    });
  });

  describe("createMacOSTestPaths", () => {
    test("REQ-008 — generates macOS-specific test paths", () => {
      const paths = createMacOSTestPaths(tempDir);

      expect(paths).toHaveProperty("claudeDir");
      expect(paths).toHaveProperty("globalNpmDir");
      expect(paths).toHaveProperty("homeDir");
      expect(paths).toHaveProperty("libraryDir");

      expect(paths.claudeDir).toMatch(/.claude$/);
      expect(paths.globalNpmDir).toMatch(/npm/);
      expect(paths.libraryDir).toMatch(/Library/);
    });

    test("REQ-008 — creates symlink-safe paths for npm global install", () => {
      const paths = createMacOSTestPaths(tempDir);

      expect(paths).toHaveProperty("npmBinDir");
      expect(paths).toHaveProperty("npmLibDir");
      expect(typeof paths.resolveSymlinks).toBe("function");
    });
  });

  describe("validateMcpServerConfig", () => {
    test("REQ-008 — validates complete MCP server configurations", () => {
      const validConfig = {
        command: "node",
        args: ["server.js"],
        env: { PORT: "3000" }
      };

      const result = validateMcpServerConfig(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("REQ-008 — detects invalid server configurations", () => {
      const invalidConfig = {
        // missing required command
        args: ["server.js"]
      };

      const result = validateMcpServerConfig(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing required field: command");
    });

    test("REQ-008 — validates macOS-specific executable paths", () => {
      const macConfig = {
        command: "/usr/local/bin/python3",
        args: ["-m", "mcp_server"]
      };

      const result = validateMcpServerConfig(macConfig, { platform: "darwin" });
      
      expect(result.isValid).toBe(true);
      expect(result.platformWarnings).toHaveLength(0);
    });
  });

  describe("createTestFixtures", () => {
    test("REQ-008 — creates realistic test data files", async () => {
      const fixtures = await createTestFixtures(tempDir, "basic-claude-setup");

      expect(fixtures).toHaveProperty("claudeConfig");
      expect(fixtures).toHaveProperty("mcpConfigs");
      expect(fixtures).toHaveProperty("packageJson");

      expect(fs.existsSync(fixtures.claudeConfig)).toBe(true);
      expect(Object.keys(fixtures.mcpConfigs)).toHaveLength.greaterThan(0);
    });

    test("REQ-008 — generates complex multi-server scenarios", async () => {
      const fixtures = await createTestFixtures(tempDir, "complex-multi-server");

      expect(Object.keys(fixtures.mcpConfigs)).toHaveLength.greaterThanOrEqual(3);
      
      // Should include different server types
      const serverTypes = Object.values(fixtures.mcpConfigs).map(config => config.serverType);
      expect(serverTypes).toContain("filesystem");
      expect(serverTypes).toContain("api");
      expect(serverTypes).toContain("database");
    });
  });

  describe("mockGlobalNpmInstall", () => {
    test("REQ-008 — simulates npm global installation on macOS", async () => {
      const mockInstall = await mockGlobalNpmInstall(tempDir, "claude-code-quickstart");

      expect(mockInstall).toHaveProperty("binPath");
      expect(mockInstall).toHaveProperty("libPath");
      expect(mockInstall).toHaveProperty("symlinkPath");

      expect(fs.existsSync(mockInstall.binPath)).toBe(true);
      expect(fs.existsSync(mockInstall.libPath)).toBe(true);
    });

    test("REQ-008 — handles npm permission scenarios", async () => {
      const mockInstall = await mockGlobalNpmInstall(tempDir, "test-package", {
        simulatePermissionError: true
      });

      expect(mockInstall).toHaveProperty("permissionError");
      expect(mockInstall.permissionError).toBe(true);
      expect(mockInstall).toHaveProperty("fallbackPath");
    });
  });
});