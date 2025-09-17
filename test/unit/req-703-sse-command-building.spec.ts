/**
 * REQ-703: SSE Command Building Validation Tests
 * Test comprehensive SSE command building with proper validation and structure
 */

import { describe, test, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { URL } from "node:url";

// Import functions from the CLI (this will fail until implemented)
let validateSSEUrl: any, buildSSECommand: any, buildCloudflareSSECommand: any,
    validateCommandStructure: any, sanitizeURLForCommand: any, validateScopeParameter: any,
    buildSSETransportArgs: any, validateServerKey: any, validateCloudflareSSEUrl: any;

try {
  const cliModule = require("../../bin/cli.js");
  validateSSEUrl = cliModule.validateSSEUrl;
  buildSSECommand = cliModule.buildSSECommand;
  buildCloudflareSSECommand = cliModule.buildCloudflareSSECommand;
  validateCommandStructure = cliModule.validateCommandStructure;
  sanitizeURLForCommand = cliModule.sanitizeURLForCommand;
  validateScopeParameter = cliModule.validateScopeParameter;
  buildSSETransportArgs = cliModule.buildSSETransportArgs;
  validateServerKey = cliModule.validateServerKey;
  validateCloudflareSSEUrl = cliModule.validateCloudflareSSEUrl;
} catch (error) {
  // Functions don't exist yet - we'll use mock implementations
  buildCloudflareSSECommand = (spec: any, scope: string): string[] => {
    throw new Error("REQ-703 buildCloudflareSSECommand not implemented");
  };
  validateCommandStructure = (command: string[]): boolean => {
    throw new Error("REQ-703 validateCommandStructure not implemented");
  };
  sanitizeURLForCommand = (url: string): string => {
    throw new Error("REQ-703 sanitizeURLForCommand not implemented");
  };
  validateScopeParameter = (scope: string): boolean => {
    throw new Error("REQ-703 validateScopeParameter not implemented");
  };
  validateServerKey = (key: string): boolean => {
    throw new Error("REQ-703 validateServerKey not implemented");
  };
  validateCloudflareSSEUrl = (url: string): boolean => {
    throw new Error("REQ-703 validateCloudflareSSEUrl not implemented");
  };
  buildSSETransportArgs = (spec: any): string[] => {
    throw new Error("REQ-703 buildSSETransportArgs not implemented");
  };
}

describe("REQ-703 — SSE Command Building Validation", () => {
  describe("URL Validation", () => {
    test("REQ-703 — validates HTTPS requirement for all SSE URLs", () => {
      const httpsUrl = "https://cloudflare-bindings.sparkry.workers.dev/";
      const httpUrl = "http://cloudflare-bindings.sparkry.workers.dev/";

      expect(validateSSEUrl(httpsUrl)).toBe(true);
      expect(validateSSEUrl(httpUrl)).toBe(false);
    });

    test("REQ-703 — validates trusted Cloudflare domains", () => {
      const validCloudflareUrl = "https://cloudflare-bindings.sparkry.workers.dev/";
      const validCustomDomain = "https://api.example.com/sse";
      const invalidDomain = "https://malicious-site.com/sse";

      expect(validateSSEUrl(validCloudflareUrl)).toBe(true);
      expect(validateSSEUrl(validCustomDomain)).toBe(true);
      expect(validateSSEUrl(invalidDomain)).toBe(false);
    });

    test("REQ-703 — prevents shell injection in URLs", () => {
      const maliciousUrls = [
        "https://example.com/; rm -rf /",
        "https://example.com/$(whoami)",
        "https://example.com/`ls`",
        "https://example.com/&& echo hacked",
        "https://example.com/| cat /etc/passwd"
      ];

      maliciousUrls.forEach(url => {
        expect(validateSSEUrl(url)).toBe(false);
      });
    });

    test("REQ-703 — prevents path traversal attacks", () => {
      const pathTraversalUrls = [
        "https://example.com/../../../etc/passwd",
        "https://example.com/..\\..\\windows\\system32",
        "https://example.com/%2e%2e%2f%2e%2e%2f",
        "https://example.com/....//....//",
        "https://example.com/..%252f..%252f"
      ];

      pathTraversalUrls.forEach(url => {
        expect(validateSSEUrl(url)).toBe(false);
      });
    });

    test("REQ-703 — property-based test for URL validation", () => {
      fc.assert(
        fc.property(
          fc.webUrl({ withFragments: false, withQueryParameters: false }),
          (url) => {
            const isValid = validateSSEUrl(url);

            if (url.startsWith("https://")) {
              // HTTPS URLs should be potentially valid (depends on domain)
              expect(typeof isValid).toBe("boolean");
            } else {
              // Non-HTTPS URLs should always be invalid
              expect(isValid).toBe(false);
            }
          }
        )
      );
    });
  });

  describe("SSE Command Structure Building", () => {
    test("REQ-703 — builds correct command structure for user scope", () => {
      const spec = {
        key: "cloudflare-bindings",
        url: "https://cloudflare-bindings.sparkry.workers.dev/"
      };

      const command = buildSSECommand(spec, "user");

      expect(command).toEqual([
        "claude",
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "sse",
        "cloudflare-bindings",
        "https://cloudflare-bindings.sparkry.workers.dev/"
      ]);
    });

    test("REQ-703 — builds correct command structure for project scope", () => {
      const spec = {
        key: "cloudflare-builds",
        url: "https://cloudflare-builds.sparkry.workers.dev/"
      };

      const command = buildSSECommand(spec, "project");

      expect(command).toEqual([
        "claude",
        "mcp",
        "add",
        "--scope",
        "project",
        "--transport",
        "sse",
        "cloudflare-builds",
        "https://cloudflare-builds.sparkry.workers.dev/"
      ]);
    });

    test("REQ-703 — builds correct command structure for local scope", () => {
      const spec = {
        key: "test-server",
        url: "https://test.example.com/sse"
      };

      const command = buildSSECommand(spec, "local");

      expect(command).toEqual([
        "claude",
        "mcp",
        "add",
        "--scope",
        "local",
        "--transport",
        "sse",
        "test-server",
        "https://test.example.com/sse"
      ]);
    });

    test("REQ-703 — validates URL before building command", () => {
      const invalidSpec = {
        key: "malicious-server",
        url: "http://malicious.com/; rm -rf /"
      };

      expect(() => {
        buildSSECommand(invalidSpec, "user");
      }).toThrow("Invalid SSE URL");
    });

    test("REQ-703 — property-based test for command structure consistency", () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9\-_]+$/.test(s)),
            url: fc.constant("https://example.com/sse")
          }),
          fc.constantFrom("user", "project", "local"),
          (spec, scope) => {
            const command = buildSSECommand(spec, scope);

            expect(Array.isArray(command)).toBe(true);
            expect(command[0]).toBe("claude");
            expect(command[1]).toBe("mcp");
            expect(command[2]).toBe("add");
            expect(command[3]).toBe("--scope");
            expect(command[4]).toBe(scope);
            expect(command[5]).toBe("--transport");
            expect(command[6]).toBe("sse");
            expect(command[7]).toBe(spec.key);
            expect(command[8]).toBe(spec.url);
          }
        )
      );
    });
  });

  describe("Command Parameter Validation", () => {
    test("REQ-703 — validates scope parameter values", () => {
      const validScopes = ["user", "project", "local"];
      const invalidScopes = ["global", "system", "admin", "", null, undefined];

      validScopes.forEach(scope => {
        expect(validateScopeParameter(scope)).toBe(true);
      });

      invalidScopes.forEach(scope => {
        expect(validateScopeParameter(scope)).toBe(false);
      });
    });

    test("REQ-703 — validates server key format", () => {
      const validKeys = [
        "cloudflare-bindings",
        "cloudflare-builds",
        "test-server",
        "my_server",
        "server123"
      ];

      const invalidKeys = [
        "",
        "server with spaces",
        "server;injection",
        "server$(command)",
        "server`command`",
        "server|pipe"
      ];

      validKeys.forEach(key => {
        expect(validateServerKey(key)).toBe(true);
      });

      invalidKeys.forEach(key => {
        expect(validateServerKey(key)).toBe(false);
      });
    });

    test("REQ-703 — sanitizes URLs for command line safety", () => {
      const unsafeUrl = "https://example.com/path?param=value&other=test";
      const sanitizedUrl = sanitizeURLForCommand(unsafeUrl);

      expect(sanitizedUrl).not.toContain("&");
      expect(sanitizedUrl).not.toContain(";");
      expect(sanitizedUrl).not.toContain("|");
      expect(sanitizedUrl).toMatch(/^https:\/\//);
    });
  });

  describe("Enhanced Cloudflare SSE Command Building", () => {
    test("REQ-703 — builds Cloudflare Bindings command with proper authentication", () => {
      const spec = {
        key: "cloudflare-bindings",
        url: "https://cloudflare-bindings.sparkry.workers.dev/",
        requiresAuth: true
      };

      const command = buildCloudflareSSECommand(spec, "user");

      expect(command).toContain("--transport");
      expect(command).toContain("sse");
      expect(command).toContain("cloudflare-bindings");
      expect(command).toContain("https://cloudflare-bindings.sparkry.workers.dev/");
    });

    test("REQ-703 — builds Cloudflare Builds command with metadata", () => {
      const spec = {
        key: "cloudflare-builds",
        url: "https://cloudflare-builds.sparkry.workers.dev/",
        metadata: {
          description: "Cloudflare Workers build management",
          version: "1.0.0"
        }
      };

      const command = buildCloudflareSSECommand(spec, "project");

      expect(command).toContain("cloudflare-builds");
      expect(command).toContain("https://cloudflare-builds.sparkry.workers.dev/");
    });

    test("REQ-703 — validates Cloudflare-specific URL patterns", () => {
      const validCloudflareUrls = [
        "https://cloudflare-bindings.sparkry.workers.dev/",
        "https://cloudflare-builds.sparkry.workers.dev/",
        "https://my-worker.example.workers.dev/"
      ];

      const invalidUrls = [
        "http://cloudflare-bindings.sparkry.workers.dev/",
        "https://fake-cloudflare.malicious.com/",
        "https://cloudflare.com/../injection"
      ];

      validCloudflareUrls.forEach(url => {
        expect(validateCloudflareSSEUrl(url)).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(validateCloudflareSSEUrl(url)).toBe(false);
      });
    });
  });

  describe("Command Structure Validation", () => {
    test("REQ-703 — validates complete command structure format", () => {
      const validCommand = [
        "claude",
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "sse",
        "server-key",
        "https://example.com/sse"
      ];

      const isValid = validateCommandStructure(validCommand);
      expect(isValid).toBe(true);
    });

    test("REQ-703 — rejects malformed command structures", () => {
      const invalidCommands = [
        [], // Empty
        ["claude"], // Incomplete
        ["wrong", "mcp", "add"], // Wrong base command
        ["claude", "wrong", "add"], // Wrong subcommand
        ["claude", "mcp", "wrong"], // Wrong action
        ["claude", "mcp", "add", "--scope", "user", "--transport", "wrong"], // Wrong transport
      ];

      invalidCommands.forEach(command => {
        expect(validateCommandStructure(command)).toBe(false);
      });
    });

    test("REQ-703 — property-based test for command array integrity", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom("user", "project", "local"),
          fc.webUrl().filter(url => url.startsWith("https://")),
          (serverKey, scope, url) => {
            // Filter out invalid characters for server keys
            const sanitizedKey = serverKey.replace(/[^a-zA-Z0-9\-_]/g, "");
            if (sanitizedKey.length === 0) return; // Skip invalid keys

            const spec = { key: sanitizedKey, url };

            try {
              const command = buildSSECommand(spec, scope);

              // Command should always be an array
              expect(Array.isArray(command)).toBe(true);

              // Command should have exactly 9 elements
              expect(command).toHaveLength(9);

              // All elements should be strings
              command.forEach(element => {
                expect(typeof element).toBe("string");
              });
            } catch (error) {
              // If validation fails, that's expected for invalid inputs
              expect(error.message).toContain("Invalid");
            }
          }
        )
      );
    });
  });

  describe("Transport Arguments Building", () => {
    test("REQ-703 — builds SSE transport arguments correctly", () => {
      const spec = {
        key: "test-server",
        url: "https://test.example.com/sse",
        transport: "sse"
      };

      const transportArgs = buildSSETransportArgs(spec);

      expect(transportArgs).toEqual([
        "--transport",
        "sse",
        "test-server",
        "https://test.example.com/sse"
      ]);
    });

    test("REQ-703 — includes additional parameters when specified", () => {
      const spec = {
        key: "test-server",
        url: "https://test.example.com/sse",
        transport: "sse",
        additionalArgs: ["--timeout", "30", "--retry", "3"]
      };

      const transportArgs = buildSSETransportArgs(spec);

      expect(transportArgs).toContain("--timeout");
      expect(transportArgs).toContain("30");
      expect(transportArgs).toContain("--retry");
      expect(transportArgs).toContain("3");
    });

    test("REQ-703 — handles authentication parameters for SSE", () => {
      const spec = {
        key: "auth-server",
        url: "https://auth.example.com/sse",
        transport: "sse",
        requiresAuth: true,
        authType: "bearer"
      };

      const transportArgs = buildSSETransportArgs(spec);

      expect(transportArgs).toContain("--transport");
      expect(transportArgs).toContain("sse");
      expect(transportArgs).toContain("auth-server");
      expect(transportArgs).toContain("https://auth.example.com/sse");
    });
  });
});

// All functions are now imported/mocked above in the try-catch block