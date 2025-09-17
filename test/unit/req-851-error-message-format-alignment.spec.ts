/**
 * REQ-851: Error Message Format Alignment Tests - TDD
 *
 * PE-Reviewer Finding: Tests expect "Invalid URL" but get "Invalid SSE URL"
 * Current Error: "Invalid SSE URL: Only HTTPS URLs from trusted domains are allowed"
 * Expected Error: "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
 *
 * Tests should expect "Invalid URL:" prefix instead of "Invalid SSE URL:"
 * Tests should validate error messages match exactly what CLI tests expect
 */

import { describe, test, expect } from "vitest";

// Import function under test
let validateSSEUrl: (url: string, returnBoolean?: boolean) => boolean | string;

try {
  const cliModule = await import("../../bin/cli.js");
  validateSSEUrl = cliModule.validateSSEUrl;
} catch (error) {
  // Function doesn't exist yet - this is expected for TDD
  validateSSEUrl = () => {
    throw new Error("validateSSEUrl function not implemented yet - REQ-851");
  };
}

describe("REQ-851 — Error message format alignment", () => {
  describe("HTTP URL validation error messages", () => {
    test("REQ-851 — throws error with 'Invalid URL:' prefix for HTTP URL", () => {
      const httpUrl = "http://insecure.example.com";

      expect(() => validateSSEUrl(httpUrl, false)).toThrow(/^Invalid URL:/);
      expect(() => validateSSEUrl(httpUrl, false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — error message contains exact expected text for HTTP URL", () => {
      const httpUrl = "http://insecure.example.com";

      expect(() => validateSSEUrl(httpUrl, false)).toThrow(
        "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
      );
    });

    test("REQ-851 — error message format is consistent across HTTP URL variations", () => {
      const httpUrls = [
        "http://example.com",
        "http://cloudflare-sse.example.com",
        "http://api.example.com/stream"
      ];

      for (const url of httpUrls) {
        expect(() => validateSSEUrl(url, false)).toThrow(
          "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
        );
      }
    });
  });

  describe("Untrusted domain error messages", () => {
    test("REQ-851 — throws error with 'Invalid URL:' prefix for untrusted domain", () => {
      const untrustedUrl = "https://evil.com/api";

      expect(() => validateSSEUrl(untrustedUrl, false)).toThrow(/^Invalid URL:/);
      expect(() => validateSSEUrl(untrustedUrl, false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — error message contains exact expected text for untrusted domain", () => {
      const untrustedUrl = "https://evil.com/api";

      expect(() => validateSSEUrl(untrustedUrl, false)).toThrow(
        "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
      );
    });
  });

  describe("Shell injection error messages", () => {
    test("REQ-851 — throws error with 'Invalid URL:' prefix for shell injection attempts", () => {
      const maliciousUrl = "https://cloudflare-sse.example.com/api?cmd=`rm -rf /`";

      expect(() => validateSSEUrl(maliciousUrl, false)).toThrow(/^Invalid URL:/);
      expect(() => validateSSEUrl(maliciousUrl, false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — error message for dangerous characters uses correct prefix", () => {
      const dangerousUrl = "https://cloudflare-sse.example.com/api;ls";

      expect(() => validateSSEUrl(dangerousUrl, false)).toThrow(/^Invalid URL:/);
      expect(() => validateSSEUrl(dangerousUrl, false)).toThrow(
        "Invalid URL: Contains potentially dangerous characters"
      );
    });
  });

  describe("Path traversal error messages", () => {
    test("REQ-851 — throws error with 'Invalid URL:' prefix for path traversal", () => {
      const traversalUrl = "https://cloudflare-sse.example.com/api/../admin";

      expect(() => validateSSEUrl(traversalUrl, false)).toThrow(/^Invalid URL:/);
      expect(() => validateSSEUrl(traversalUrl, false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — error message for path traversal uses correct prefix", () => {
      const traversalUrl = "https://cloudflare-sse.example.com/api/../admin";

      expect(() => validateSSEUrl(traversalUrl, false)).toThrow(
        "Invalid URL: Contains path traversal patterns"
      );
    });
  });

  describe("Malformed URL error messages", () => {
    test("REQ-851 — throws error with 'Invalid URL:' prefix for malformed URLs", () => {
      const malformedUrl = "not-a-url-at-all";

      expect(() => validateSSEUrl(malformedUrl, false)).toThrow(/^Invalid URL/);
      expect(() => validateSSEUrl(malformedUrl, false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — error message for malformed URL format uses correct prefix", () => {
      const malformedUrl = "not-a-url-at-all";

      expect(() => validateSSEUrl(malformedUrl, false)).toThrow(/^Invalid URL format:/);
    });
  });

  describe("Empty/null URL error messages", () => {
    test("REQ-851 — throws appropriate error for empty string URL", () => {
      expect(() => validateSSEUrl("", false)).toThrow("SSE URL must be a non-empty string");
      expect(() => validateSSEUrl("", false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — throws appropriate error for null URL", () => {
      // @ts-ignore - Testing runtime behavior
      expect(() => validateSSEUrl(null, false)).toThrow("SSE URL must be a non-empty string");
    });

    test("REQ-851 — throws appropriate error for undefined URL", () => {
      // @ts-ignore - Testing runtime behavior
      expect(() => validateSSEUrl(undefined, false)).toThrow("SSE URL must be a non-empty string");
    });

    test("REQ-851 — throws appropriate error for whitespace-only URL", () => {
      expect(() => validateSSEUrl("   ", false)).toThrow("SSE URL must be a non-empty string");
    });
  });

  describe("Double slash pattern error messages", () => {
    test("REQ-851 — throws error with 'Invalid URL:' prefix for double slash patterns", () => {
      const doubleSlashUrl = "https://cloudflare-sse.example.com/api//stream";

      expect(() => validateSSEUrl(doubleSlashUrl, false)).toThrow(/^Invalid URL:/);
      expect(() => validateSSEUrl(doubleSlashUrl, false)).not.toThrow(/^Invalid SSE URL:/);
    });

    test("REQ-851 — error message for double slash uses correct prefix", () => {
      const doubleSlashUrl = "https://cloudflare-sse.example.com/api//stream";

      expect(() => validateSSEUrl(doubleSlashUrl, false)).toThrow(
        "Invalid URL: Contains invalid double slash patterns in path"
      );
    });
  });

  describe("Error message consistency validation", () => {
    test("REQ-851 — no error messages should contain 'Invalid SSE URL:' prefix", () => {
      const testUrls = [
        "http://insecure.example.com",
        "https://evil.com/api",
        "https://cloudflare-sse.example.com/api;ls",
        "https://cloudflare-sse.example.com/api/../admin",
        "https://cloudflare-sse.example.com/api//stream"
      ];

      for (const url of testUrls) {
        try {
          validateSSEUrl(url, false);
        } catch (error) {
          expect(error.message).not.toMatch(/^Invalid SSE URL:/);
        }
      }
    });

    test("REQ-851 — all validation errors should use 'Invalid URL:' prefix where appropriate", () => {
      const testUrls = [
        {
          url: "http://insecure.example.com",
          expectedMessage: "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
        },
        {
          url: "https://evil.com/api",
          expectedMessage: "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
        },
        {
          url: "https://cloudflare-sse.example.com/api;ls",
          expectedMessage: "Invalid URL: Contains potentially dangerous characters"
        },
        {
          url: "https://cloudflare-sse.example.com/api/../admin",
          expectedMessage: "Invalid URL: Contains path traversal patterns"
        },
        {
          url: "https://cloudflare-sse.example.com/api//stream",
          expectedMessage: "Invalid URL: Contains invalid double slash patterns in path"
        }
      ];

      for (const testCase of testUrls) {
        expect(() => validateSSEUrl(testCase.url, false)).toThrow(testCase.expectedMessage);
      }
    });

    test("REQ-851 — error messages match CLI test expectations exactly", () => {
      // These are the exact error messages that CLI tests expect
      const httpUrl = "http://insecure.example.com";
      expect(() => validateSSEUrl(httpUrl, false)).toThrow(
        "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
      );

      const untrustedUrl = "https://evil.com/api";
      expect(() => validateSSEUrl(untrustedUrl, false)).toThrow(
        "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
      );
    });
  });
});