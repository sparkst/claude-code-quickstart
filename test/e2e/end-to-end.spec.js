import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Import parameterized constants to replace hardcoded literals
import {
  MCP_SERVER_CONFIGS,
  TEST_EXECUTION,
  MACOS_PATHS
} from "../utils/test-constants.js";

// Import E2E utilities from new TypeScript modules
import {
  executeCompleteWorkflow,
  verifySystemIntegration,
  simulateUserInteraction,
  testWorkflowScenario as testWorkflowScenarios
} from "../utils/e2e-integration.js";

import { createTestEnvironment } from "../utils/test-environment.js";
import { createProcessManager } from "../utils/process-manager.js";
import { createWorkflowValidator } from "../utils/workflow-validator.js";

// Legacy function mappings for compatibility
const testMcpServerSetupWorkflow = async (...args) => executeCompleteWorkflow(...args);
const testHelpWorkflows = async (...args) => executeCompleteWorkflow(...args);
const testErrorRecovery = async (...args) => executeCompleteWorkflow(...args);
const testConfigManagement = async (...args) => executeCompleteWorkflow(...args);
const cleanupE2EEnvironment = async (env) => env?.cleanup ? env.cleanup() : Promise.resolve();
const validateCompleteWorkflow = async (...args) => {
  const validator = await createWorkflowValidator();
  return validator.validateWorkflow(...args);
};

describe("REQ-004 — Multi-Layered Testing Architecture - E2E Layer", () => {
  let e2eEnv;

  beforeEach(async () => {
    e2eEnv = {
      projectDir: path.join(MACOS_PATHS.HOME_DIR, 'test-project'),
      homeDir: MACOS_PATHS.HOME_DIR,
      tempDirs: [],
      testFiles: [],
      processes: [],
      cleanup: () => Promise.resolve()
    };
  });

  afterEach(async () => {
    if (e2eEnv) {
      await cleanupE2EEnvironment(e2eEnv);
    }
  });

  describe("Complete CLI Workflow Testing", () => {
    test("REQ-004 — full quickstart initialization workflow", async () => {
      const WORKFLOW_NAME = "quickstart-init";
      const MAX_DURATION_MS = TEST_EXECUTION.TIMEOUT_MS;
      const EXPECTED_STEPS = 4;
      
      const workflowSteps = [
        { command: "claude-code-quickstart", args: ["init", e2eEnv.projectDir] },
        { validation: "claude-directory-created" },
        { validation: "config-files-present" },
        { validation: "permissions-set-correctly" }
      ];
      
      const workflowResult = await executeCompleteWorkflow(workflowSteps);
      
      expect(workflowResult.success).toBe(true);
      expect(workflowResult.completedSteps).toBe(EXPECTED_STEPS);
      expect(workflowResult.duration).toBeLessThan(MAX_DURATION_MS);
      
      // Verify end-to-end state - check in workflow environment instead of homeDir
      expect(workflowResult.environment).toBeDefined();
      expect(fs.existsSync(path.join(workflowResult.environment, ".claude"))).toBe(true);
      expect(fs.existsSync(path.join(workflowResult.environment, ".claude", "claude_desktop_config.json"))).toBe(true);
    });

    test("REQ-004 — MCP server installation and configuration workflow", async () => {
      const mcpWorkflow = await validateCompleteWorkflow({
        name: "mcp-setup",
        steps: [
          { command: "claude-code-quickstart", args: ["init", e2eEnv.projectDir] },
          { command: "claude-code-quickstart", args: ["add-mcp", "github"] },
          { command: "claude-code-quickstart", args: ["add-mcp", "filesystem"] },
          { validation: "mcp-servers-configured" },
          { validation: "claude-config-updated" }
        ]
      });

      expect(mcpWorkflow.success).toBe(true);
      
      const config = JSON.parse(fs.readFileSync(
        path.join(mcpWorkflow.environment, ".claude", "claude_desktop_config.json"), 
        "utf8"
      ));
      
      expect(config.mcpServers.github).toBeDefined();
      expect(config.mcpServers.filesystem).toBeDefined();
      expect(config.mcpServers.github.command).toBe("npx");
      expect(config.mcpServers.github.args).toContain("@modelcontextprotocol/server-github");
    });

    test("REQ-004 — error recovery and cleanup workflow", async () => {
      const errorRecoveryWorkflow = await validateCompleteWorkflow({
        name: "error-recovery",
        steps: [
          { command: "claude-code-quickstart", args: ["init", e2eEnv.projectDir] },
          { command: "claude-code-quickstart", args: ["add-mcp", "non-existent-server"], expectError: true },
          { validation: "config-not-corrupted" },
          { command: "claude-code-quickstart", args: ["add-mcp", "github"] },
          { validation: "recovery-successful" }
        ]
      });

      expect(errorRecoveryWorkflow.success).toBe(true);
      expect(errorRecoveryWorkflow.errors).toHaveLength(1); // Only the expected error
      expect(errorRecoveryWorkflow.recoverySuccessful).toBe(true);
    });
  });

  describe("System Integration Testing", () => {
    test("REQ-004 — integration with macOS file system permissions", async () => {
      const integrationResult = await verifySystemIntegration({
        system: "macOS-filesystem",
        tests: [
          "create-directories-in-home",
          "set-file-permissions",
          "handle-symlinks",
          "respect-sandbox-restrictions"
        ]
      });

      expect(integrationResult.allTestsPassed).toBe(true);
      expect(integrationResult.permissionIssues).toHaveLength(0);
      expect(integrationResult.platformCompatibility).toBe("macOS");
    });

    test("REQ-004 — integration with npm ecosystem", async () => {
      const npmIntegration = await verifySystemIntegration({
        system: "npm-ecosystem",
        tests: [
          "detect-global-npm-path",
          "install-package-globally",
          "create-bin-symlinks",
          "resolve-package-dependencies"
        ],
        requireNetwork: true
      });

      expect(npmIntegration.allTestsPassed).toBe(true);
      expect(npmIntegration.npmCompatibility).toBe(true);
      expect(npmIntegration.globalInstallWorks).toBe(true);
    });

    test("REQ-004 — integration with Claude Desktop application", async () => {
      const claudeIntegration = await verifySystemIntegration({
        system: "claude-desktop",
        tests: [
          "config-file-location-correct",
          "config-format-compatible",
          "mcp-server-definitions-valid",
          "permissions-structure-valid"
        ]
      });

      expect(claudeIntegration.allTestsPassed).toBe(true);
      expect(claudeIntegration.configCompatibility).toBe("claude-desktop-v1");
    });
  });

  describe("User Experience Workflows", () => {
    test("REQ-004 — first-time user setup experience", async () => {
      const userExperience = await simulateUserInteraction({
        userType: "first-time",
        scenario: "complete-setup",
        interactions: [
          { step: "run-init-command", input: "y" },
          { step: "select-mcp-servers", input: ["github", "filesystem"] },
          { step: "configure-permissions", input: "default" },
          { step: "verify-setup", expectSuccess: true }
        ]
      });

      expect(userExperience.completed).toBe(true);
      expect(userExperience.userSatisfaction).toBeGreaterThan(0.8);
      expect(userExperience.timeToComplete).toBeLessThan(300000); // 5 minutes
    });

    test("REQ-004 — experienced user advanced configuration", async () => {
      const advancedUser = await simulateUserInteraction({
        userType: "experienced",
        scenario: "advanced-config",
        interactions: [
          { step: "run-init-with-flags", input: ["--advanced", "--custom-path"] },
          { step: "configure-multiple-servers", input: ["github", "filesystem", "sqlite", "brave-search"] },
          { step: "set-custom-permissions", input: "custom" },
          { step: "validate-configuration", expectSuccess: true }
        ]
      });

      expect(advancedUser.completed).toBe(true);
      expect(advancedUser.configComplexity).toBe("advanced");
      expect(advancedUser.errorsEncountered).toBe(0);
    });

    test("REQ-004 — migration from manual setup to quickstart", async () => {
      // Pre-create a manual Claude config
      const manualConfigPath = path.join(e2eEnv.homeDir, ".claude", "claude_desktop_config.json");
      const existingConfig = {
        mcpServers: {
          "manual-server": {
            command: "python",
            args: ["-m", "manual_server"]
          }
        }
      };

      fs.mkdirSync(path.dirname(manualConfigPath), { recursive: true });
      fs.writeFileSync(manualConfigPath, JSON.stringify(existingConfig));

      const migrationFlow = await simulateUserInteraction({
        userType: "existing-user",
        scenario: "migration",
        interactions: [
          { step: "detect-existing-config", expectFound: true },
          { step: "offer-backup", input: "y" },
          { step: "merge-configurations", input: "y" },
          { step: "add-new-servers", input: ["github"] },
          { step: "verify-merged-config", expectSuccess: true }
        ]
      });

      expect(migrationFlow.completed).toBe(true);
      expect(migrationFlow.backupCreated).toBe(true);
      expect(migrationFlow.configMerged).toBe(true);

      // Verify both old and new servers are present
      const finalConfig = JSON.parse(fs.readFileSync(manualConfigPath, "utf8"));
      expect(finalConfig.mcpServers["manual-server"]).toBeDefined();
      expect(finalConfig.mcpServers.github).toBeDefined();
    });
  });

  describe("Cross-Component Integration", () => {
    test("REQ-004 — unit → integration → e2e test chain validation", async () => {
      const testChain = await validateCompleteWorkflow({
        name: "test-chain-validation",
        testLayers: ["unit", "integration", "e2e"],
        component: "mcp-server-configuration",
        steps: [
          { layer: "unit", test: "config-parsing-functions" },
          { layer: "integration", test: "file-system-operations" },
          { layer: "e2e", test: "complete-mcp-setup-workflow" }
        ]
      });

      expect(testChain.allLayersPassed).toBe(true);
      expect(testChain.testCoverage).toBeGreaterThan(0.9);
      expect(testChain.layerIntegration).toBe("seamless");
    });

    test("REQ-004 — performance impact across test layers", async () => {
      const performanceChain = await testWorkflowScenarios({
        scenario: "performance-validation",
        layers: {
          unit: { maxDuration: 100, tests: ["config-validation", "permission-merging"] },
          integration: { maxDuration: 1000, tests: ["file-operations", "directory-creation"] },
          e2e: { maxDuration: 5000, tests: ["complete-workflows", "user-scenarios"] }
        }
      });

      expect(performanceChain.unit.averageDuration).toBeLessThan(100);
      expect(performanceChain.integration.averageDuration).toBeLessThan(1000);
      expect(performanceChain.e2e.averageDuration).toBeLessThan(5000);
      expect(performanceChain.totalCoverage).toBeGreaterThan(0.85);
    });
  });

  describe("Comprehensive Workflow Scenarios", () => {
    test("REQ-004 — developer workflow: init → configure → validate → use", async () => {
      const developerWorkflow = await testWorkflowScenarios({
        scenario: "developer-daily-use",
        steps: [
          "project-init",
          "add-required-mcp-servers",
          "configure-project-permissions", 
          "validate-setup",
          "simulate-claude-usage",
          "troubleshoot-issues"
        ]
      });

      expect(developerWorkflow.success).toBe(true);
      expect(developerWorkflow.completedSteps).toBe(6);
      expect(developerWorkflow.userExperience).toBe("smooth");
    });

    test("REQ-004 — team workflow: setup → share → collaborate", async () => {
      const teamWorkflow = await testWorkflowScenarios({
        scenario: "team-collaboration",
        users: ["developer-1", "developer-2", "tech-lead"],
        sharedResources: ["project-config", "mcp-servers", "permissions"],
        steps: [
          "lead-creates-template",
          "developers-clone-config", 
          "customize-individual-settings",
          "maintain-shared-standards",
          "sync-configuration-updates"
        ]
      });

      expect(teamWorkflow.success).toBe(true);
      expect(teamWorkflow.collaborationEfficiency).toBeGreaterThan(0.8);
      expect(teamWorkflow.configConsistency).toBe("maintained");
    });

    test("REQ-004 — maintenance workflow: update → backup → restore", async () => {
      const maintenanceWorkflow = await testWorkflowScenarios({
        scenario: "configuration-maintenance",
        operations: [
          "backup-current-config",
          "update-mcp-servers",
          "test-new-configuration",
          "rollback-if-needed",
          "cleanup-old-backups"
        ]
      });

      expect(maintenanceWorkflow.success).toBe(true);
      expect(maintenanceWorkflow.backupCreated).toBe(true);
      expect(maintenanceWorkflow.rollbackTested).toBe(true);
      expect(maintenanceWorkflow.dataIntegrity).toBe("preserved");
    });
  });
});