import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Import functions to test - we'll need to extract these from cli.js
const loadJsonSafe = (p, fallback) => {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    try {
      fs.copyFileSync(p, `${p}.bak`);
    } catch {
      // Ignore backup errors
    }
    return fallback;
  }
};

const ensureDefaultMode = (obj) => {
  if (!obj.defaultMode) obj.defaultMode = "plan";
  return obj;
};

const mergePermissions = (base) => {
  const deny = new Set([
    "Read(*.env)",
    "Read(**/*.pem)",
    "Read(**/*.key)",
    "Read(**/secrets/**)",
    "Read(**/credentials/**)",
    "Read(~/.*ssh/**)",
    "Edit(*.env)",
    "Edit(**/*.pem)",
    "Edit(**/*.key)",
    "Edit(**/secrets/**)",
    "Edit(**/credentials/**)",
  ]);
  const ask = new Set(["Bash(*)", "Edit(/**)"]);
  const allow = new Set([
    "Read(/**)",
    "Bash(npm run test*)",
    "Bash(yarn test*)",
    "Bash(pnpm test*)",
    "Bash(npx vitest*)",
    "Bash(npx jest*)",
    "Bash(npm run lint*)",
    "Bash(npm run typecheck)",
    "Bash(npm run prettier:check)",
  ]);

  const out = base || {};
  out.permissions = out.permissions || {};
  for (const [k, set] of [
    ["deny", deny],
    ["ask", ask],
    ["allow", allow],
  ]) {
    const existing = new Set(out.permissions[k] || []);
    for (const item of set) existing.add(item);
    out.permissions[k] = Array.from(existing);
  }
  return out;
};

const maskKey = (s) => {
  if (!s) return "";
  if (s.length <= 2) return "…";
  if (s.length <= 8) return s[0] + "…" + s.slice(-1);
  return s.slice(0, 5) + "…" + s.slice(-3);
};

const ensureServersPreserved = (existing) => {
  const out = existing && typeof existing === "object" ? { ...existing } : {};
  out.mcpServers =
    out.mcpServers && typeof out.mcpServers === "object"
      ? { ...out.mcpServers }
      : {};
  return out;
};

describe("loadJsonSafe", () => {
  test("returns fallback for non-existent file", () => {
    const fallback = { default: true };
    const result = loadJsonSafe("/nonexistent/path.json", fallback);
    expect(result).toBe(fallback);
  });

  test("returns fallback for invalid JSON with backup", () => {
    const tempFile = path.join(os.tmpdir(), "invalid.json");
    fs.writeFileSync(tempFile, "invalid json content");

    const fallback = { error: "handled" };
    const result = loadJsonSafe(tempFile, fallback);

    expect(result).toEqual(fallback);
    expect(fs.existsSync(`${tempFile}.bak`)).toBe(true);

    // Cleanup
    fs.unlinkSync(tempFile);
    fs.unlinkSync(`${tempFile}.bak`);
  });

  test("parses valid JSON correctly", () => {
    const tempFile = path.join(os.tmpdir(), "valid.json");
    const testData = { test: "data", number: 42 };
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    const result = loadJsonSafe(tempFile, {});

    expect(result).toEqual(testData);

    // Cleanup
    fs.unlinkSync(tempFile);
  });
});

describe("ensureDefaultMode", () => {
  test("adds plan mode when missing", () => {
    const input = { someOtherProp: "value" };
    const result = ensureDefaultMode(input);

    expect(result.defaultMode).toBe("plan");
    expect(result.someOtherProp).toBe("value");
  });

  test("preserves existing defaultMode", () => {
    const input = { defaultMode: "code", otherProp: "value" };
    const result = ensureDefaultMode(input);

    expect(result.defaultMode).toBe("code");
    expect(result.otherProp).toBe("value");
  });

  test("modifies original object reference", () => {
    const input = {};
    const result = ensureDefaultMode(input);

    expect(result).toBe(input);
    expect(input.defaultMode).toBe("plan");
  });
});

describe("mergePermissions", () => {
  test("creates permissions structure for empty object", () => {
    const result = mergePermissions({});

    expect(result.permissions).toBeDefined();
    expect(result.permissions.deny).toContain("Read(*.env)");
    expect(result.permissions.ask).toContain("Bash(*)");
    expect(result.permissions.allow).toContain("Read(/**)");
  });

  test("preserves existing permissions while adding defaults", () => {
    const existing = {
      permissions: {
        deny: ["CustomDeny"],
        ask: ["CustomAsk"],
        allow: ["CustomAllow"],
      },
    };

    const result = mergePermissions(existing);

    expect(result.permissions.deny).toContain("CustomDeny");
    expect(result.permissions.deny).toContain("Read(*.env)");
    expect(result.permissions.ask).toContain("CustomAsk");
    expect(result.permissions.ask).toContain("Bash(*)");
    expect(result.permissions.allow).toContain("CustomAllow");
    expect(result.permissions.allow).toContain("Read(/**)");
  });

  test("handles null base gracefully", () => {
    const result = mergePermissions(null);

    expect(result).toBeDefined();
    expect(result.permissions).toBeDefined();
    expect(result.permissions.deny.length).toBeGreaterThan(0);
  });

  test("avoids duplicates when merging", () => {
    const existing = {
      permissions: {
        deny: ["Read(*.env)"],
        ask: ["Bash(*)"],
        allow: ["Read(**)"],
      },
    };

    const result = mergePermissions(existing);

    const denyCount = result.permissions.deny.filter(
      (p) => p === "Read(*.env)"
    ).length;
    expect(denyCount).toBe(1);
  });
});

describe("maskKey", () => {
  test("returns empty string for falsy input", () => {
    expect(maskKey("")).toBe("");
    expect(maskKey(null)).toBe("");
    expect(maskKey(undefined)).toBe("");
  });

  test("returns ellipsis for very short strings", () => {
    expect(maskKey("a")).toBe("…");
    expect(maskKey("ab")).toBe("…");
  });

  test("masks short strings with first and last character", () => {
    expect(maskKey("abc")).toBe("a…c");
    expect(maskKey("test123")).toBe("t…3");
    expect(maskKey("12345678")).toBe("1…8");
  });

  test("masks long strings with first 5 and last 3 characters", () => {
    expect(maskKey("sk-1234567890abcdef")).toBe("sk-12…def");
    expect(maskKey("very-long-api-key-example")).toBe("very-…ple");
  });
});

describe("ensureServersPreserved", () => {
  test("creates empty structure for null input", () => {
    const result = ensureServersPreserved(null);

    expect(result).toEqual({ mcpServers: {} });
  });

  test("creates empty structure for undefined input", () => {
    const result = ensureServersPreserved(undefined);

    expect(result).toEqual({ mcpServers: {} });
  });

  test("preserves existing structure", () => {
    const existing = {
      someProperty: "value",
      mcpServers: {
        github: {
          command: "npx",
          args: ["@modelcontextprotocol/server-github"],
        },
      },
    };

    const result = ensureServersPreserved(existing);

    expect(result.someProperty).toBe("value");
    expect(result.mcpServers.github).toEqual(existing.mcpServers.github);
  });

  test("creates mcpServers if missing", () => {
    const existing = { someProperty: "value" };

    const result = ensureServersPreserved(existing);

    expect(result.someProperty).toBe("value");
    expect(result.mcpServers).toEqual({});
  });

  test("handles invalid mcpServers gracefully", () => {
    const existing = { mcpServers: "invalid" };

    const result = ensureServersPreserved(existing);

    expect(result.mcpServers).toEqual({});
  });
});
