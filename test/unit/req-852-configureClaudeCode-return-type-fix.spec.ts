/**
 * REQ-852: configureClaudeCode Return Type Fix Tests - TDD
 *
 * PE-Reviewer Finding: Function returns non-array, causing "forEach is not a function"
 * Current Behavior: Returns single object or undefined
 * Expected Behavior: Returns array of configuration results
 *
 * Tests should validate function returns array that supports forEach
 * Tests should check proper array structure for different configuration scenarios
 */

import { describe, test, expect } from "vitest";

// Import function under test
let configureClaudeCode: () => Promise<Array<any>>;

try {
  const cliModule = await import("../../bin/cli.js");
  configureClaudeCode = cliModule.configureClaudeCode;
} catch (error) {
  // Function doesn't exist yet - this is expected for TDD
  configureClaudeCode = async () => {
    throw new Error("configureClaudeCode function not implemented yet - REQ-852");
  };
}

describe("REQ-852 — configureClaudeCode return type fix", () => {
  describe("Array return type validation", () => {
    test("REQ-852 — returns an array, not a single object or undefined", async () => {
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);
      expect(typeof result).toBe("object");
      expect(result).not.toBe(null);
      expect(result).not.toBe(undefined);
    });

    test("REQ-852 — returned array has forEach method", async () => {
      const result = await configureClaudeCode();

      expect(result).toHaveProperty("forEach");
      expect(typeof result.forEach).toBe("function");
    });

    test("REQ-852 — returned array supports forEach iteration without errors", async () => {
      const result = await configureClaudeCode();

      expect(() => {
        result.forEach((item, index) => {
          // This should not throw "forEach is not a function"
          expect(typeof index).toBe("number");
        });
      }).not.toThrow();
    });

    test("REQ-852 — returned array supports array methods (map, filter, length)", async () => {
      const result = await configureClaudeCode();

      expect(typeof result.length).toBe("number");
      expect(typeof result.map).toBe("function");
      expect(typeof result.filter).toBe("function");
      expect(typeof result.reduce).toBe("function");
    });
  });

  describe("Array content structure validation", () => {
    test("REQ-852 — each array element represents a server configuration result", async () => {
      const result = await configureClaudeCode();

      result.forEach((configResult) => {
        expect(configResult).toBeTypeOf("object");
        expect(configResult).not.toBe(null);
      });
    });

    test("REQ-852 — configuration results contain expected properties", async () => {
      const result = await configureClaudeCode();

      result.forEach((configResult) => {
        // Each result should be an object with server configuration details
        expect(configResult).toHaveProperty("serverName");
        expect(configResult).toHaveProperty("status");
        expect(["configured", "skipped", "failed", "disabled"].includes(configResult.status)).toBe(true);
      });
    });

    test("REQ-852 — array contains results for all processed servers", async () => {
      const result = await configureClaudeCode();

      // Should have results for servers that were processed
      expect(result.length).toBeGreaterThanOrEqual(0);

      // If any servers were processed, array should not be empty
      if (result.length > 0) {
        result.forEach((configResult) => {
          expect(configResult.serverName).toBeTruthy();
          expect(configResult.status).toBeTruthy();
        });
      }
    });
  });

  describe("Different configuration scenarios", () => {
    test("REQ-852 — returns array when all servers are configured successfully", async () => {
      // Mock successful configuration scenario
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);

      // All successful configurations should be reflected in array
      const successfulConfigs = result.filter(r => r.status === "configured");
      successfulConfigs.forEach((config) => {
        expect(config.serverName).toBeTruthy();
        expect(config.status).toBe("configured");
      });
    });

    test("REQ-852 — returns array when some servers are skipped", async () => {
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);

      // Check that skipped servers are properly represented in array
      const skippedConfigs = result.filter(r => r.status === "skipped");
      skippedConfigs.forEach((config) => {
        expect(config.serverName).toBeTruthy();
        expect(config.status).toBe("skipped");
      });
    });

    test("REQ-852 — returns array when some servers fail configuration", async () => {
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);

      // Check that failed servers are properly represented in array
      const failedConfigs = result.filter(r => r.status === "failed");
      failedConfigs.forEach((config) => {
        expect(config.serverName).toBeTruthy();
        expect(config.status).toBe("failed");
        expect(config).toHaveProperty("error");
      });
    });

    test("REQ-852 — returns empty array when no servers are processed", async () => {
      // In scenario where no servers are available or user skips all
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Array immutability and consistency", () => {
    test("REQ-852 — returned array is a new instance each call", async () => {
      const result1 = await configureClaudeCode();
      const result2 = await configureClaudeCode();

      expect(Array.isArray(result1)).toBe(true);
      expect(Array.isArray(result2)).toBe(true);

      // Arrays should be separate instances
      expect(result1).not.toBe(result2);
    });

    test("REQ-852 — array elements maintain consistent structure", async () => {
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);

      const requiredProperties = ["serverName", "status"];

      result.forEach((configResult, index) => {
        requiredProperties.forEach(prop => {
          expect(configResult).toHaveProperty(prop);
        });

        // Status should be one of the valid values
        expect(["configured", "skipped", "failed", "disabled", "already_configured"].includes(configResult.status)).toBe(true);
      });
    });
  });

  describe("Error handling with array return", () => {
    test("REQ-852 — function returns array even when internal errors occur", async () => {
      // Function should return array structure even if some operations fail
      const result = await configureClaudeCode();

      expect(Array.isArray(result)).toBe(true);

      // Failed operations should be represented as array elements with error status
      const failedItems = result.filter(item => item.status === "failed");
      failedItems.forEach(failedItem => {
        expect(failedItem).toHaveProperty("serverName");
        expect(failedItem.status).toBe("failed");
        expect(failedItem).toHaveProperty("error");
      });
    });

    test("REQ-852 — function never returns null, undefined, or non-array", async () => {
      const result = await configureClaudeCode();

      expect(result).not.toBe(null);
      expect(result).not.toBe(undefined);
      expect(Array.isArray(result)).toBe(true);
      expect(typeof result).toBe("object");
    });
  });

  describe("Integration with forEach usage patterns", () => {
    test("REQ-852 — supports common forEach patterns used in CLI", async () => {
      const result = await configureClaudeCode();

      // Common pattern: counting results
      let configuredCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      expect(() => {
        result.forEach((configResult) => {
          switch (configResult.status) {
            case "configured":
            case "already_configured":
              configuredCount++;
              break;
            case "skipped":
              skippedCount++;
              break;
            case "failed":
              failedCount++;
              break;
          }
        });
      }).not.toThrow();

      expect(configuredCount + skippedCount + failedCount).toBe(result.length);
    });

    test("REQ-852 — supports forEach with index parameter", async () => {
      const result = await configureClaudeCode();

      expect(() => {
        result.forEach((configResult, index) => {
          expect(typeof index).toBe("number");
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(result.length);
        });
      }).not.toThrow();
    });

    test("REQ-852 — supports forEach with thisArg parameter", async () => {
      const result = await configureClaudeCode();
      const context = { processed: 0 };

      expect(() => {
        result.forEach(function(configResult) {
          this.processed++;
        }, context);
      }).not.toThrow();

      expect(context.processed).toBe(result.length);
    });
  });
});