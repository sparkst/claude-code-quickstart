/**
 * REQ-714: Property-Based Tests for Validation Functions
 * Comprehensive property-based testing using fast-check for existing validation functions
 */

import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { URL } from "node:url";

// Import existing validation functions from CLI
const {
  validateSSEUrl,
  buildSSECommand,
  buildClaudeMcpCommand,
  maskKey,
  shouldMaskEnvVar,
  formatExistingValue,
} = require("../../bin/cli.js");

describe("REQ-714 — Property-Based Tests for Validation Functions", () => {
  describe("validateSSEUrl Property Tests", () => {
    test("REQ-714 — validateSSEUrl always rejects non-HTTPS URLs", () => {
      fc.assert(
        fc.property(
          fc.webUrl().filter((url) => !url.startsWith("https://")),
          (url) => {
            const result = validateSSEUrl(url, true);
            expect(result).toBe(false);
          }
        )
      );
    });

    test("REQ-714 — validateSSEUrl validates HTTPS URLs", () => {
      fc.assert(
        fc.property(
          fc.webUrl().filter((url) => url.startsWith("https://")),
          (url) => {
            const result = validateSSEUrl(url, true);
            expect(typeof result).toBe("boolean");

            // URL should not contain dangerous characters
            const dangerousChars = /[;&|`$(){}[\]\\<>'"]/;
            if (dangerousChars.test(url)) {
              expect(result).toBe(false);
            }
          }
        )
      );
    });

    test("REQ-714 — validateSSEUrl handles malformed input consistently", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(""),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.string())
          ),
          (invalidInput) => {
            const result = validateSSEUrl(invalidInput, true);
            expect(result).toBe(false);
          }
        )
      );
    });

    test("REQ-714 — validateSSEUrl shell injection prevention is comprehensive", () => {
      const maliciousChars = [
        ";",
        "&",
        "|",
        "`",
        "$",
        "(",
        ")",
        "{",
        "}",
        "[",
        "]",
        "\\",
        "<",
        ">",
        "'",
        '"',
      ];

      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(...maliciousChars),
          fc.string(),
          (prefix, dangerousChar, suffix) => {
            const maliciousUrl = `https://example.com/${prefix}${dangerousChar}${suffix}`;
            const result = validateSSEUrl(maliciousUrl, true);
            expect(result).toBe(false);
          }
        )
      );
    });

    test("REQ-714 — validateSSEUrl path traversal prevention", () => {
      const traversalPatterns = [
        "../",
        "..\\",
        "%2e%2e%2f",
        "....//",
        "..%252f",
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...traversalPatterns),
          fc.string({ minLength: 1, maxLength: 10 }),
          (traversalPattern, path) => {
            const maliciousUrl = `https://example.com/${traversalPattern}${path}`;
            const result = validateSSEUrl(maliciousUrl, true);
            expect(result).toBe(false);
          }
        )
      );
    });

    test("REQ-714 — validateSSEUrl error handling modes are consistent", () => {
      fc.assert(
        fc.property(fc.string(), fc.boolean(), (url, returnBoolean) => {
          if (returnBoolean) {
            const result = validateSSEUrl(url, true);
            expect(typeof result).toBe("boolean");
          } else {
            try {
              const result = validateSSEUrl(url, false);
              expect(typeof result).toBe("string"); // Should return the URL if valid
            } catch (error) {
              expect(error).toBeInstanceOf(Error);
              expect(error.message).toContain("SSE");
            }
          }
        })
      );
    });
  });

  describe("buildSSECommand Property Tests", () => {
    test("REQ-714 — buildSSECommand always produces valid command arrays", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            url: fc.constant("https://example.com/sse"), // Use safe URL
          }),
          fc.constantFrom("user", "project", "local"),
          (spec, scope) => {
            const command = buildSSECommand(spec, scope);

            // Command should always be an array
            expect(Array.isArray(command)).toBe(true);

            // Command should have proper structure
            expect(command[0]).toBe("claude");
            expect(command[1]).toBe("mcp");
            expect(command[2]).toBe("add");

            // Should contain transport and sse
            expect(command).toContain("--transport");
            expect(command).toContain("sse");

            // Should contain the server key and URL
            expect(command).toContain(spec.key);
            expect(command).toContain(spec.url);

            // All elements should be strings
            command.forEach((element) => {
              expect(typeof element).toBe("string");
              expect(element.length).toBeGreaterThan(0);
            });
          }
        )
      );
    });

    test("REQ-714 — buildSSECommand scope handling is consistent", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            url: fc.constant("https://example.com/sse"),
          }),
          fc.constantFrom("user", "project", "local"),
          (spec, scope) => {
            const command = buildSSECommand(spec, scope);

            if (scope === "local") {
              // Local scope should not include --scope parameter
              expect(command).not.toContain("--scope");
              expect(command).not.toContain("local");
            } else {
              // Non-local scopes should include --scope parameter
              expect(command).toContain("--scope");
              expect(command).toContain(scope);
            }
          }
        )
      );
    });

    test("REQ-714 — buildSSECommand rejects invalid URLs consistently", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            url: fc.oneof(
              fc.constant("http://insecure.com"),
              fc.constant("https://example.com/; rm -rf /"),
              fc.constant("invalid-url"),
              fc.constant("")
            ),
          }),
          fc.constantFrom("user", "project", "local"),
          (spec, scope) => {
            expect(() => {
              buildSSECommand(spec, scope);
            }).toThrow();
          }
        )
      );
    });
  });

  describe("buildClaudeMcpCommand Property Tests", () => {
    test("REQ-714 — buildClaudeMcpCommand handles SSE transport correctly", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            url: fc.constant("https://example.com/sse"),
            transport: fc.constant("sse"),
          }),
          fc.constantFrom("user", "project", "local"),
          fc.object(), // envVars
          (spec, scope, envVars) => {
            const command = buildClaudeMcpCommand(spec, scope, envVars);

            // Should delegate to buildSSECommand for SSE transport
            expect(Array.isArray(command)).toBe(true);
            expect(command).toContain("claude");
            expect(command).toContain("mcp");
            expect(command).toContain("add");
            expect(command).toContain("--transport");
            expect(command).toContain("sse");
          }
        )
      );
    });

    test("REQ-714 — buildClaudeMcpCommand handles npm packages correctly", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            command: fc.constant("npx"),
            args: fc.constant(["-y", "@test/package"]),
          }),
          fc.constantFrom("user", "project", "local"),
          fc.object(), // envVars
          (spec, scope, envVars) => {
            const command = buildClaudeMcpCommand(spec, scope, envVars);

            // Should be a string for npm packages
            expect(typeof command).toBe("string");
            expect(command).toContain("claude mcp add");
            expect(command).toContain(spec.key);
          }
        )
      );
    });

    test("REQ-714 — buildClaudeMcpCommand environment variable handling", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            command: fc.constant("node"),
            args: fc.array(fc.string()),
          }),
          fc.constantFrom("user", "project", "local"),
          fc.record({
            TEST_VAR: fc.string(),
            API_KEY: fc.string(),
          }),
          (spec, scope, envVars) => {
            const command = buildClaudeMcpCommand(spec, scope, envVars);

            // Environment variables should be properly formatted
            if (typeof command === "string") {
              Object.keys(envVars).forEach((varName) => {
                if (envVars[varName]) {
                  expect(command).toContain(`${varName}=${envVars[varName]}`);
                }
              });
            }
          }
        )
      );
    });
  });

  describe("Utility Function Property Tests", () => {
    test("REQ-714 — maskKey preserves structure while hiding content", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 10, maxLength: 100 }), (key) => {
          const masked = maskKey(key);

          expect(typeof masked).toBe("string");
          expect(masked.length).toBeGreaterThan(0);

          if (key.length > 8) {
            // Should show some characters at start/end
            expect(masked).toContain("*");
            expect(masked.length).toBeGreaterThanOrEqual(8);
          }

          // Should not contain the full original key
          if (key.length > 10) {
            expect(masked).not.toBe(key);
          }
        })
      );
    });

    test("REQ-714 — shouldMaskEnvVar identifies sensitive variables correctly", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (envVarName) => {
            const shouldMask = shouldMaskEnvVar(envVarName);
            expect(typeof shouldMask).toBe("boolean");

            const lowercaseName = envVarName.toLowerCase();
            const sensitiveKeywords = [
              "key",
              "token",
              "secret",
              "password",
              "auth",
            ];

            const containsSensitive = sensitiveKeywords.some((keyword) =>
              lowercaseName.includes(keyword)
            );

            if (containsSensitive) {
              expect(shouldMask).toBe(true);
            }
          }
        )
      );
    });

    test("REQ-714 — formatExistingValue handles different value types consistently", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (envVarName, value) => {
            const formatted = formatExistingValue(envVarName, value);

            expect(typeof formatted).toBe("string");

            if (value === null || value === undefined) {
              expect(formatted).toBe("");
            } else {
              expect(formatted.length).toBeGreaterThan(0);
            }

            // Sensitive values should be masked
            if (
              shouldMaskEnvVar(envVarName) &&
              value &&
              typeof value === "string" &&
              value.length > 8
            ) {
              expect(formatted).toContain("*");
            }
          }
        )
      );
    });
  });

  describe("Command Array to String Conversion", () => {
    test("REQ-714 — array to string conversion is safe and reversible", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 1,
            maxLength: 10,
          }),
          (commandArray) => {
            // Filter out arrays that contain shell-dangerous characters or spaces
            const safeArray = commandArray.filter(
              (item) =>
                !/[;&|`$(){}[\]\\<>'" ]/u.test(item) && item.trim() !== ""
            );

            if (safeArray.length > 0) {
              const commandString = safeArray.join(" ");

              // String should not contain dangerous characters
              expect(commandString).not.toMatch(/[;&|`$(){}[\]\\<>'"]/);

              // String should contain all original elements
              safeArray.forEach((element) => {
                expect(commandString).toContain(element);
              });

              // String should be properly space-separated
              const reconstructed = commandString.split(" ");
              expect(reconstructed).toEqual(safeArray);
            }
          }
        )
      );
    });
  });

  describe("Error Message Property Tests", () => {
    test("REQ-714 — error messages are informative and consistent", () => {
      const invalidInputs = [
        null,
        undefined,
        "",
        "http://insecure.com",
        "https://example.com/; rm -rf /",
        "not-a-url",
      ];

      invalidInputs.forEach((input) => {
        try {
          validateSSEUrl(input, false);
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain("SSE");
          expect(error.message.length).toBeGreaterThan(10);
          expect(error.message.length).toBeLessThan(200);
        }
      });
    });
  });

  describe("Idempotency Property Tests", () => {
    test("REQ-714 — validation functions are deterministic", () => {
      fc.assert(
        fc.property(fc.string(), fc.boolean(), (url, returnBoolean) => {
          // Handle both success and error cases for deterministic behavior
          let result1, error1;
          let result2, error2;

          try {
            result1 = validateSSEUrl(url, returnBoolean);
          } catch (e) {
            error1 = e.message;
          }

          try {
            result2 = validateSSEUrl(url, returnBoolean);
          } catch (e) {
            error2 = e.message;
          }

          // Both should succeed or both should fail with same error message
          if (error1 || error2) {
            expect(error1).toEqual(error2);
          } else {
            expect(result1).toEqual(result2);
          }
        })
      );
    });

    test("REQ-714 — command building is deterministic", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9\-_]+$/.test(s)),
            url: fc.constant("https://example.com/sse"),
          }),
          fc.constantFrom("user", "project", "local"),
          (spec, scope) => {
            try {
              const command1 = buildSSECommand(spec, scope);
              const command2 = buildSSECommand(spec, scope);

              expect(command1).toEqual(command2);
            } catch (error) {
              // If one call throws, both should throw the same error
              expect(() => buildSSECommand(spec, scope)).toThrow();
            }
          }
        )
      );
    });
  });
});
