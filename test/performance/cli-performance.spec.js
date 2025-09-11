import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Import parameterized constants to replace hardcoded literals
import {
  PERFORMANCE_THRESHOLDS,
  TEST_EXECUTION,
  TEST_DATA
} from "../utils/test-constants.js";

// Import minimal performance utilities (will throw with TODO messages)
import {
  measurePerformance,
  measureStartupTime,
  measureMemoryUsage,
  validatePerformanceMetrics,
  analyzePerformanceTrends,
  simulateSystemLoad,
  measureConcurrentPerformance,
  measureCliStartup
} from "../utils/performance-helpers.js";

describe("REQ-006 — Performance Validation Framework", () => {
  let testEnv;
  let performanceBaseline;

  beforeEach(async () => {
    testEnv = await measurePerformance(() => Promise.resolve('setup'));
    performanceBaseline = await measureStartupTime('claude-code-quickstart'); // Get baseline measurement
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe("CLI Startup Performance", () => {
    test("REQ-006 — CLI startup completes within performance threshold", async () => {
      const CLI_COMMAND = "claude-code-quickstart";
      const CLI_ARGS = ["--version"];
      const startupMetrics = await measureStartupTime(CLI_COMMAND, CLI_ARGS);

      expect(startupMetrics.averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STARTUP_TIME_MS);
      expect(startupMetrics.maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STARTUP_MAX_TIME_MS);
      expect(startupMetrics.minTime).toBeGreaterThan(0);
      expect(startupMetrics.iterations).toBe(TEST_EXECUTION.PERFORMANCE_ITERATIONS);
    });

    test("REQ-006 — cold start vs warm start performance difference", async () => {
      // Measure cold start (first execution)
      const coldStart = await measureCliStartup({
        iterations: 1,
        clearCache: true
      });

      // Measure warm start (subsequent executions)
      const warmStart = await measureCliStartup({
        iterations: 3,
        clearCache: false
      });

      expect(coldStart.averageTime).toBeGreaterThan(warmStart.averageTime);
      expect(warmStart.averageTime).toBeLessThan(300); // Warm starts should be faster
    });

    test("REQ-006 — startup performance with various flag combinations", async () => {
      const flagCombinations = [
        [],
        ["--help"],
        ["--version"],
        ["init"],
        ["init", "--verbose"],
      ];

      for (const flags of flagCombinations) {
        const metrics = await measureCliStartup({
          args: flags,
          iterations: 3
        });

        expect(metrics.averageTime).toBeLessThan(500);
        expect(metrics.successRate).toBe(1.0); // All runs should succeed
      }
    });
  });

  describe("Configuration Parsing Performance", () => {
    test("REQ-006 — small config parsing under 50ms", async () => {
      const smallConfig = {
        mcpServers: {
          github: {
            command: "npx",
            args: ["@modelcontextprotocol/server-github"]
          }
        },
        permissions: {
          allow: ["Read(**)"],
          deny: ["Read(*.env)"]
        }
      };

      const parseMetrics = await measureConfigParsing({
        config: smallConfig,
        iterations: 10
      });

      expect(parseMetrics.averageTime).toBeLessThan(50);
      expect(parseMetrics.maxTime).toBeLessThan(100);
    });

    test("REQ-006 — large config with 20+ MCP servers parsing under 200ms", async () => {
      const largeConfig = await generateLargeConfig({
        serverCount: 25,
        complexPermissions: true,
        nestedStructures: true
      });

      const parseMetrics = await measureConfigParsing({
        config: largeConfig,
        iterations: 5
      });

      expect(parseMetrics.averageTime).toBeLessThan(200);
      expect(parseMetrics.configSize).toBeGreaterThan(10000); // Should be substantial
    });

    test("REQ-006 — malformed config error handling performance", async () => {
      const malformedConfigs = [
        "{ invalid json",
        '{"mcpServers": undefined}',
        '{"mcpServers": {"server1": null}}',
        "{}" // Valid but empty
      ];

      for (const config of malformedConfigs) {
        const errorHandlingMetrics = await measureConfigParsing({
          config,
          iterations: 3,
          expectError: true
        });

        // Error handling should still be fast
        expect(errorHandlingMetrics.averageTime).toBeLessThan(100);
        expect(errorHandlingMetrics.errorCount).toBeGreaterThan(0);
      }
    });
  });

  describe("File Operation Performance", () => {
    test("REQ-006 — .claude directory creation under 100ms", async () => {
      const fileOpMetrics = await measureFileOperations({
        operation: "createClaudeDir",
        targetPath: testEnv.tempDir,
        iterations: 5
      });

      expect(fileOpMetrics.averageTime).toBeLessThan(100);
      expect(fileOpMetrics.successRate).toBe(1.0);
    });

    test("REQ-006 — config file write and read cycle under 75ms", async () => {
      const config = await generateLargeConfig({ serverCount: 10 });
      const configPath = path.join(testEnv.tempDir, "claude_desktop_config.json");

      const writeMetrics = await measureFileOperations({
        operation: "writeConfig",
        targetPath: configPath,
        data: config,
        iterations: 10
      });

      const readMetrics = await measureFileOperations({
        operation: "readConfig", 
        targetPath: configPath,
        iterations: 10
      });

      expect(writeMetrics.averageTime + readMetrics.averageTime).toBeLessThan(75);
      expect(writeMetrics.successRate).toBe(1.0);
      expect(readMetrics.successRate).toBe(1.0);
    });

    test("REQ-006 — concurrent file operations performance", async () => {
      const concurrentOps = [];
      const numConcurrentOps = 5;

      for (let i = 0; i < numConcurrentOps; i++) {
        concurrentOps.push(
          measureFileOperations({
            operation: "createTempFile",
            targetPath: path.join(testEnv.tempDir, `temp-${i}.json`),
            data: { index: i },
            iterations: 1
          })
        );
      }

      const results = await Promise.all(concurrentOps);
      const totalTime = Math.max(...results.map(r => r.totalTime));

      // Concurrent operations should not take much longer than sequential
      expect(totalTime).toBeLessThan(200);
      results.forEach(result => {
        expect(result.successRate).toBe(1.0);
      });
    });
  });

  describe("Memory Usage Monitoring", () => {
    test("REQ-006 — CLI memory usage stays under 50MB for normal operations", async () => {
      const memoryMetrics = await monitorMemoryUsage({
        operation: "normalCliUsage",
        duration: 1000, // 1 second
        command: "claude-code-quickstart",
        args: ["init", testEnv.tempDir]
      });

      expect(memoryMetrics.peakMemoryMB).toBeLessThan(50);
      expect(memoryMetrics.averageMemoryMB).toBeLessThan(30);
      expect(memoryMetrics.memoryLeaks).toBe(false);
    });

    test("REQ-006 — memory usage with large configuration files", async () => {
      const largeConfig = await generateLargeConfig({
        serverCount: 50,
        largeEnvVars: true,
        complexPermissions: true
      });

      const memoryMetrics = await monitorMemoryUsage({
        operation: "processLargeConfig",
        data: largeConfig,
        duration: 2000
      });

      expect(memoryMetrics.peakMemoryMB).toBeLessThan(100);
      expect(memoryMetrics.memoryGrowthRate).toBeLessThan(0.1); // 10% growth max
    });

    test("REQ-006 — garbage collection efficiency", async () => {
      const gcMetrics = await monitorMemoryUsage({
        operation: "processMultipleConfigs",
        iterations: 20,
        forceGC: true,
        duration: 5000
      });

      expect(gcMetrics.gcEfficiency).toBeGreaterThan(0.8); // 80% efficiency minimum
      expect(gcMetrics.memoryReclaimedMB).toBeGreaterThan(0);
    });
  });

  describe("Network and Async Operation Performance", () => {
    test("REQ-006 — MCP server validation timeout handling", async () => {
      const asyncMetrics = await measureAsyncOperations({
        operation: "validateMcpServers",
        servers: [
          "unreachable-server-1",
          "unreachable-server-2", 
          "unreachable-server-3"
        ],
        timeout: 1000,
        concurrent: true
      });

      expect(asyncMetrics.totalTime).toBeLessThan(1200); // Should respect timeout
      expect(asyncMetrics.timeoutCount).toBe(3);
      expect(asyncMetrics.averageResponseTime).toBeLessThan(1000);
    });

    test("REQ-006 — npm package availability checks performance", async () => {
      const packageChecks = [
        "@modelcontextprotocol/server-github",
        "@modelcontextprotocol/server-filesystem",
        "non-existent-package-12345"
      ];

      const checkMetrics = await measureAsyncOperations({
        operation: "checkPackageAvailability",
        packages: packageChecks,
        timeout: 2000,
        concurrent: true
      });

      expect(checkMetrics.totalTime).toBeLessThan(2500);
      expect(checkMetrics.successfulChecks).toBeGreaterThan(0);
    });
  });

  describe("Performance Regression Detection", () => {
    test("REQ-006 — detects performance regressions against baseline", async () => {
      const currentMetrics = await measureCliStartup({
        iterations: 10
      });

      const regression = await validatePerformanceThresholds({
        current: currentMetrics,
        baseline: performanceBaseline,
        regressionThreshold: 0.2 // 20% slower is a regression
      });

      expect(regression.hasRegression).toBe(false);
      expect(regression.performanceRatio).toBeLessThan(1.2);
      expect(regression.recommendation).toBeDefined();
    });

    test("REQ-006 — tracks performance trends over time", async () => {
      const performanceHistory = [];
      
      // Simulate multiple runs over time
      for (let i = 0; i < 5; i++) {
        const metrics = await measureCliStartup({ iterations: 3 });
        performanceHistory.push({
          timestamp: Date.now(),
          metrics
        });
        
        // Small delay between measurements
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const trendAnalysis = await validatePerformanceThresholds({
        history: performanceHistory,
        detectTrends: true
      });

      expect(trendAnalysis.trend).toMatch(/improving|stable|degrading/);
      expect(trendAnalysis.confidenceLevel).toBeGreaterThan(0.5);
    });

    test("REQ-006 — validates all performance thresholds in single run", async () => {
      const comprehensiveMetrics = {
        startup: await measureCliStartup({ iterations: 3 }),
        configParsing: await measureConfigParsing({ 
          config: await generateLargeConfig({ serverCount: 10 }),
          iterations: 3
        }),
        fileOperations: await measureFileOperations({
          operation: "fullClaudeSetup",
          targetPath: testEnv.tempDir,
          iterations: 3
        }),
        memory: await monitorMemoryUsage({
          operation: "normalCliUsage",
          duration: 2000
        })
      };

      const overallValidation = await validatePerformanceThresholds({
        metrics: comprehensiveMetrics,
        thresholds: {
          startup: 500,
          configParsing: 200, 
          fileOperations: 100,
          memoryMB: 50
        }
      });

      expect(overallValidation.allThresholdsMet).toBe(true);
      expect(overallValidation.failedThresholds).toHaveLength(0);
      expect(overallValidation.performanceScore).toBeGreaterThan(0.8);
    });
  });
});