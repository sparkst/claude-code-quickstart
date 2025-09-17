/**
 * REQ-712: Authentication Messaging Enhancement Tests
 * Test comprehensive authentication messaging improvements for clear server guidance
 */

import { describe, test, expect, beforeEach } from "vitest";
import fc from "fast-check";

// Import functions from the CLI (this will fail until implemented)
let formatServerDescription: any, validatePostInstallMessage: any, validateAPIKeyFormat: any,
    getAuthRequirementsByServerType: any, generatePostInstallInstructions: any, enhanceErrorMessage: any;

try {
  const cliModule = require("../../bin/cli.js");
  formatServerDescription = cliModule.formatServerDescription;
  validatePostInstallMessage = cliModule.validatePostInstallMessage;
  validateAPIKeyFormat = cliModule.validateAPIKeyFormat;
  getAuthRequirementsByServerType = cliModule.getAuthRequirementsByServerType;
  generatePostInstallInstructions = cliModule.generatePostInstallInstructions;
  enhanceErrorMessage = cliModule.enhanceErrorMessage;
} catch (error) {
  // Functions don't exist yet - we'll use mock implementations
  formatServerDescription = (serverSpec: any): string => {
    throw new Error("REQ-712 formatServerDescription not implemented");
  };
  validatePostInstallMessage = (serverKey: string, status: string): string => {
    throw new Error("REQ-712 validatePostInstallMessage not implemented");
  };
  validateAPIKeyFormat = (provider: string, key: string): boolean => {
    throw new Error("REQ-712 validateAPIKeyFormat not implemented");
  };
  getAuthRequirementsByServerType = (serverType: string): any => {
    throw new Error("REQ-712 getAuthRequirementsByServerType not implemented");
  };
  generatePostInstallInstructions = (serverKey: string): string => {
    throw new Error("REQ-712 generatePostInstallInstructions not implemented");
  };
  enhanceErrorMessage = (serverKey: string, error: Error, errorType: string): string => {
    throw new Error("REQ-712 enhanceErrorMessage not implemented");
  };
}

describe("REQ-712 — Authentication Messaging Enhancement", () => {
  describe("Server Description Formatting", () => {
    test("REQ-712 — formats simple server descriptions with API token requirements", () => {
      const serverSpec = {
        type: "simple",
        title: "GitHub",
        requiresAuth: true,
        setupTime: 2
      };

      const description = formatServerDescription(serverSpec);

      expect(description).toContain("🔑 Needs: API Access Token (2 min setup)");
      expect(description).toContain("GitHub");
    });

    test("REQ-712 — formats SSE server descriptions with browser authentication", () => {
      const serverSpec = {
        type: "sse",
        title: "Cloudflare Bindings",
        requiresAuth: true,
        setupTime: 3
      };

      const description = formatServerDescription(serverSpec);

      expect(description).toContain("🌐 Needs: Browser authentication + Claude Code setup (3 min)");
      expect(description).toContain("Cloudflare Bindings");
    });

    test("REQ-712 — formats complex server descriptions with URL and credentials", () => {
      const serverSpec = {
        type: "complex",
        title: "Supabase",
        requiresAuth: true,
        setupTime: 5
      };

      const description = formatServerDescription(serverSpec);

      expect(description).toContain("⚙️ Needs: URL + credentials (5 min setup)");
      expect(description).toContain("Supabase");
    });

    test("REQ-712 — property-based test for description format consistency", () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom("simple", "sse", "complex"),
            title: fc.string({ minLength: 1, maxLength: 20 }),
            requiresAuth: fc.boolean(),
            setupTime: fc.integer({ min: 1, max: 10 })
          }),
          (serverSpec) => {
            const description = formatServerDescription(serverSpec);

            // All descriptions should contain an emoji
            expect(description).toMatch(/^[🔑🌐⚙️]/);
            // All descriptions should contain the title
            expect(description).toContain(serverSpec.title);
            // All descriptions should contain setup time
            expect(description).toContain(`${serverSpec.setupTime} min`);
          }
        )
      );
    });
  });

  describe("Post-Install Message Validation", () => {
    test("REQ-712 — validates successful Supabase configuration message", () => {
      const message = validatePostInstallMessage("supabase", "success");

      expect(message).toBe("✅ Supabase configured → Ready to use immediately");
    });

    test("REQ-712 — validates Cloudflare next steps message", () => {
      const message = validatePostInstallMessage("cloudflare-bindings", "success");

      expect(message).toBe("✅ Cloudflare installed → NEXT: Run `/mcp cloudflare-bindings` in Claude Code");
    });

    test("REQ-712 — generates proper failure messages", () => {
      const message = validatePostInstallMessage("github", "failure");

      expect(message).toContain("❌");
      expect(message).toContain("GitHub");
      expect(message).toMatch(/authentication|configuration|setup/);
    });

    test("REQ-712 — property-based test for message format consistency", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom("success", "failure", "pending"),
          (serverKey, status) => {
            const message = validatePostInstallMessage(serverKey, status);

            if (status === "success") {
              expect(message).toMatch(/^✅/);
              expect(message).toContain("→");
            } else if (status === "failure") {
              expect(message).toMatch(/^❌/);
            }

            expect(message).toContain(serverKey);
          }
        )
      );
    });
  });

  describe("Real-time API Key Format Validation", () => {
    test("REQ-712 — validates GitHub API key format", () => {
      const validGitHubKey = "ghp_1234567890abcdef1234567890abcdef123456";
      const invalidGitHubKey = "invalid-key";

      expect(validateAPIKeyFormat("github", validGitHubKey)).toBe(true);
      expect(validateAPIKeyFormat("github", invalidGitHubKey)).toBe(false);
    });

    test("REQ-712 — validates Supabase API key format", () => {
      const validSupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example";
      const invalidSupabaseKey = "sb-invalid-key";

      expect(validateAPIKeyFormat("supabase", validSupabaseKey)).toBe(true);
      expect(validateAPIKeyFormat("supabase", invalidSupabaseKey)).toBe(false);
    });

    test("REQ-712 — validates OpenAI API key format", () => {
      const validOpenAIKey = "sk-1234567890abcdef1234567890abcdef12345678";
      const invalidOpenAIKey = "openai-invalid";

      expect(validateAPIKeyFormat("openai", validOpenAIKey)).toBe(true);
      expect(validateAPIKeyFormat("openai", invalidOpenAIKey)).toBe(false);
    });

    test("REQ-712 — property-based test for API key validation", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("github", "supabase", "openai", "anthropic"),
          fc.string({ minLength: 10, maxLength: 100 }),
          (provider, key) => {
            const isValid = validateAPIKeyFormat(provider, key);

            // Result should be boolean
            expect(typeof isValid).toBe("boolean");

            // Empty or very short keys should always be invalid
            if (key.length < 10) {
              expect(isValid).toBe(false);
            }
          }
        )
      );
    });
  });

  describe("Authentication Requirements by Server Type", () => {
    test("REQ-712 — returns correct auth requirements for simple servers", () => {
      const requirements = getAuthRequirementsByServerType("simple");

      expect(requirements).toEqual({
        emoji: "🔑",
        description: "API Access Token",
        estimatedTime: 2,
        complexity: "low"
      });
    });

    test("REQ-712 — returns correct auth requirements for SSE servers", () => {
      const requirements = getAuthRequirementsByServerType("sse");

      expect(requirements).toEqual({
        emoji: "🌐",
        description: "Browser authentication + Claude Code setup",
        estimatedTime: 3,
        complexity: "medium"
      });
    });

    test("REQ-712 — returns correct auth requirements for complex servers", () => {
      const requirements = getAuthRequirementsByServerType("complex");

      expect(requirements).toEqual({
        emoji: "⚙️",
        description: "URL + credentials",
        estimatedTime: 5,
        complexity: "high"
      });
    });

    test("REQ-712 — throws error for unknown server types", () => {
      expect(() => {
        getAuthRequirementsByServerType("unknown");
      }).toThrow("Unsupported server type: unknown");
    });
  });

  describe("Post-Install Instructions Generation", () => {
    test("REQ-712 — generates immediate-use instructions for simple servers", () => {
      const instructions = generatePostInstallInstructions("github");

      expect(instructions).toContain("Ready to use immediately");
      expect(instructions).toContain("✅");
      expect(instructions).not.toContain("NEXT:");
    });

    test("REQ-712 — generates next-step instructions for SSE servers", () => {
      const instructions = generatePostInstallInstructions("cloudflare-bindings");

      expect(instructions).toContain("NEXT: Run `/mcp cloudflare-bindings` in Claude Code");
      expect(instructions).toContain("✅");
    });

    test("REQ-712 — generates configuration verification for complex servers", () => {
      const instructions = generatePostInstallInstructions("supabase");

      expect(instructions).toContain("configured");
      expect(instructions).toContain("Ready to use");
      expect(instructions).toContain("✅");
    });

    test("REQ-712 — property-based test for instruction completeness", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("github", "supabase", "cloudflare-bindings", "tavily", "context7"),
          (serverKey) => {
            const instructions = generatePostInstallInstructions(serverKey);

            // All instructions should be positive and actionable
            expect(instructions).toMatch(/✅/);
            expect(instructions).toContain(serverKey);
            expect(instructions.length).toBeGreaterThan(10);
            expect(instructions.length).toBeLessThan(200);
          }
        )
      );
    });
  });

  describe("Error Message Enhancement", () => {
    test("REQ-712 — generates specific error messages for authentication failures", () => {
      const error = new Error("Authentication failed");
      const enhancedMessage = enhanceErrorMessage("github", error, "authentication");

      expect(enhancedMessage).toContain("GitHub authentication failed");
      expect(enhancedMessage).toContain("API token may be invalid");
      expect(enhancedMessage).toMatch(/Check your.*token/i);
    });

    test("REQ-712 — generates specific error messages for network failures", () => {
      const error = new Error("ENOTFOUND");
      const enhancedMessage = enhanceErrorMessage("cloudflare-bindings", error, "network");

      expect(enhancedMessage).toContain("Network connection failed");
      expect(enhancedMessage).toContain("Cloudflare Bindings");
      expect(enhancedMessage).toMatch(/network.*connection/i);
    });

    test("REQ-712 — generates specific error messages for configuration failures", () => {
      const error = new Error("Invalid configuration");
      const enhancedMessage = enhanceErrorMessage("supabase", error, "configuration");

      expect(enhancedMessage).toContain("Configuration error");
      expect(enhancedMessage).toContain("Supabase");
      expect(enhancedMessage).toMatch(/URL.*credentials/i);
    });
  });
});

// All functions are now imported/mocked above in the try-catch block