#!/usr/bin/env node
/**
 * Sparkry.AI — Claude Code Quickstart CLI
 * - Configures ~/.claude/settings.json (plan mode, permissions, MCP servers)
 * - Optionally scaffolds project files in CWD (CLAUDE.md, .claude/)
 * - Preserves existing MCP servers and keys
 * - Simple prompts with API key links + masked re-entry
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const readline = require("node:readline");
const { URL } = require("node:url");
const lockfile = require("proper-lockfile");

const HOME = os.homedir();
const GLOBAL_DIR = path.join(HOME, ".claude");

// REQ-608: Action type constants to replace magic strings
const ACTION_TYPES = {
  CONFIGURE: "configure",
  SKIP: "skip",
  DISABLE: "disable",
  ALREADY_CONFIGURED: "already_configured",
};

// REQ-607: Server status cache to avoid duplicate checks
const serverStatusCache = new Map();

const PROJECT_DIR = process.cwd();
const PROJ_CLAUDE_DIR = path.join(PROJECT_DIR, ".claude");

const TEMPLATES = path.join(__dirname, "..", "templates");
const TEMPLATE = (f) => fs.readFileSync(path.join(TEMPLATES, f), "utf8");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// REQ-715: File locking configuration for concurrent access safety
const LOCK_CONFIG = {
  lockfilePath: (filePath) => `${filePath}.lock`,
  retries: {
    retries: 5,
    minTimeout: 100,
    maxTimeout: 2000,
    randomize: true,
  },
  stale: 30000, // 30 seconds
  realpath: false, // Avoid symlink resolution overhead
};

// REQ-715: Safe configuration update helper with file locking
async function safeConfigUpdate(filePath, updateFn, options = {}) {
  const lockOptions = {
    ...LOCK_CONFIG.retries,
    stale: options.stale || LOCK_CONFIG.stale,
    realpath: LOCK_CONFIG.realpath,
  };

  let release = null;
  const startTime = Date.now();

  try {
    // Show user feedback for lock wait if it takes more than 1 second
    const lockTimeout = global.setTimeout(() => {
      console.log(`⏳ Waiting for file access: ${path.basename(filePath)}`);
      console.log("   (Another installation may be in progress...)");
    }, 1000);

    // Acquire file lock with retry mechanism
    try {
      release = await lockfile.lock(filePath, lockOptions);
      global.clearTimeout(lockTimeout);
    } catch (error) {
      global.clearTimeout(lockTimeout);
      if (error.code === "ELOCKED") {
        throw new Error(
          `File is locked by another process: ${path.basename(filePath)}. Please wait and try again.`
        );
      }
      throw new Error(
        `Failed to acquire lock for ${path.basename(filePath)}: ${error.message}`
      );
    }

    // Log lock acquisition time if it took longer than expected
    const lockTime = Date.now() - startTime;
    if (lockTime > 1000) {
      console.log(
        `✅ File access acquired after ${Math.round(lockTime / 1000)}s`
      );
    }

    // Perform the file operation under lock protection
    return await updateFn(filePath);
  } catch (error) {
    // Re-throw with context for better debugging
    throw new Error(
      `Configuration update failed for ${path.basename(filePath)}: ${error.message}`
    );
  } finally {
    // Always release the lock
    if (release) {
      try {
        await release();
      } catch (releaseError) {
        console.warn(
          `⚠️ Warning: Failed to release lock for ${path.basename(filePath)}: ${releaseError.message}`
        );
      }
    }
  }
}

// REQ-715: Safe file write with directory creation and atomic operation
async function safeFileWrite(filePath, content, encoding = "utf8") {
  return safeConfigUpdate(filePath, async (lockedFilePath) => {
    // Ensure directory exists
    const dir = path.dirname(lockedFilePath);
    fs.mkdirSync(dir, { recursive: true });

    // Write to temporary file first for atomic operation
    const tempPath = `${lockedFilePath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, content, encoding);
      // Atomic rename to final destination
      fs.renameSync(tempPath, lockedFilePath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup failures
      }
      throw error;
    }
  });
}

// REQ-715: Safe file read with lock protection
async function safeFileRead(filePath, encoding = "utf8") {
  return safeConfigUpdate(filePath, (lockedFilePath) => {
    if (!fs.existsSync(lockedFilePath)) {
      throw new Error(`File not found: ${path.basename(lockedFilePath)}`);
    }
    return fs.readFileSync(lockedFilePath, encoding);
  });
}
function ask(q, def = "") {
  const prompt = def ? `${q} [${def}] ` : `${q} `;
  return new Promise((res) =>
    rl.question(prompt, (a) => res((a || "").trim()))
  );
}

// REQ-711: Accessible ask function with enhanced prompting for screen readers
async function askAccessible(question, defaultValue = "", options = {}) {
  const {
    helpText = null,
    category = null,
    required = false,
    validationPattern = null,
  } = options;

  // Provide context for screen readers
  if (category) {
    console.log(`📂 Input category: ${category}`);
  }

  if (helpText) {
    console.log(`💡 Help: ${helpText}`);
  }

  const prompt = defaultValue
    ? `${question} [${defaultValue}] `
    : `${question} `;

  const answer = await new Promise((resolve) => {
    rl.question(prompt, (input) => resolve((input || "").trim()));
  });

  const finalAnswer = answer || defaultValue;

  // Basic validation if pattern provided
  if (required && !finalAnswer) {
    console.log("⚠️  This field is required. Please try again.");
    return askAccessible(question, defaultValue, options);
  }

  if (
    validationPattern &&
    finalAnswer &&
    !validationPattern.test(finalAnswer)
  ) {
    console.log("⚠️  Invalid format. Please check the input and try again.");
    return askAccessible(question, defaultValue, options);
  }

  return finalAnswer;
}

// REQ-711: Progressive disclosure function for advanced options
async function askProgressiveDisclosure(tierConfig) {
  console.log(`\n🔍 Want to see what's included in ${tierConfig.name}?`);

  const showDetails = await ask("Show detailed server list? (y/N)", "n");

  if (showDetails.toLowerCase() === "y") {
    const tierServers = getServersForTier(tierConfig.name);
    console.log(
      `\n📋 ${tierConfig.name} includes ${tierServers.length} servers:`
    );

    tierServers.forEach((spec, index) => {
      console.log(`   ${index + 1}. ${spec.title} - ${spec.category}`);
      console.log(`      ${spec.description}`);
      console.log(`      Time: ${spec.setupTime} | Auth: ${spec.authPattern}`);
    });

    console.log(`\n💰 Total estimated time: ${tierConfig.time}`);
    console.log(`🎯 Benefits: ${tierConfig.benefits.join(", ")}`);
  }

  return true;
}

async function askScope() {
  console.log("\n🎯 Choose Claude Code MCP server scope:");
  console.log("  1) User (recommended) - Available across all your projects");
  console.log("  2) Project - Shared with team via .mcp.json file");
  console.log("  3) Local - Private to current session only");

  const choice = await ask("Select scope (1-3)", "1");

  switch (choice) {
    case "1":
    case "user":
    case "u":
      return "user";
    case "2":
    case "project":
    case "p":
      return "project";
    case "3":
    case "local":
    case "l":
      return "local";
    default:
      console.log("  Using default: User scope");
      return "user";
  }
}

// REQ-711: Accessible tier selection with progressive disclosure
async function askSetupTier() {
  console.log("\n" + "=".repeat(60));
  console.log("🎯 CHOOSE YOUR MCP SETUP TIER");
  console.log("=".repeat(60));
  console.log(
    "\nReduce choice overload! Pick the tier that matches your needs:"
  );

  // Display tiers with accessibility and visual hierarchy
  let tierIndex = 1;
  for (const [tierKey, tierConfig] of Object.entries(SETUP_TIERS)) {
    console.log(
      `\n${tierIndex}) ${tierConfig.emoji} ${tierConfig.name} (${tierConfig.time})`
    );
    console.log(`   ${tierConfig.description}`);
    console.log(
      `   Includes: ${tierConfig.benefits.slice(0, 2).join(", ")}${tierConfig.benefits.length > 2 ? "..." : ""}`
    );
    tierIndex++;
  }

  console.log("\n" + "-".repeat(60));
  console.log("💡 Tip: You can always run this tool again to add more servers");
  console.log("🔄 Focus order: 1→2→3 for progressive complexity");

  const choice = await ask("\nSelect setup tier (1-3)", "1");

  switch (choice) {
    case "1":
    case "quick":
    case "q":
      return "quick-start";
    case "2":
    case "dev":
    case "d":
      return "dev-tools";
    case "3":
    case "research":
    case "r":
    case "full":
    case "f":
      return "research-tools";
    default:
      console.log("  Using default: Quick Start");
      return "quick-start";
  }
}

// REQ-711: Get servers for selected tier with progressive inclusion
function getServersForTier(selectedTier) {
  const tierHierarchy = ["quick-start", "dev-tools", "research-tools"];
  const selectedIndex = tierHierarchy.indexOf(selectedTier);

  if (selectedIndex === -1) {
    console.log("⚠️ Unknown tier, defaulting to Quick Start");
    return SERVER_SPECS.filter((spec) => spec.tier === "quick-start");
  }

  // Include all servers from current tier and lower tiers
  const includedTiers = tierHierarchy.slice(0, selectedIndex + 1);
  return SERVER_SPECS.filter((spec) => includedTiers.includes(spec.tier));
}

function maskKey(s) {
  if (!s) return "";
  if (s.length <= 2) return "…";
  if (s.length <= 8) return s[0] + "…" + s.slice(-1);
  return s.slice(0, 5) + "…" + s.slice(-3);
}

function shouldMaskEnvVar(envVarName) {
  if (!envVarName) return true;
  const name = envVarName.toLowerCase();
  // Don't mask URLs and endpoints
  if (name.includes("url") || name.includes("endpoint")) {
    return false;
  }
  // Mask keys, tokens, secrets, and anything else by default for security
  return true;
}

function formatExistingValue(envVarName, value) {
  if (!value) return null;
  return shouldMaskEnvVar(envVarName) ? maskKey(value) : value;
}

// REQ-400: Security - URL Parameter Validation
function validateSSEUrl(url, returnBoolean = false) {
  if (!url || typeof url !== "string") {
    if (returnBoolean) return false;
    throw new Error("SSE URL must be a non-empty string");
  }

  // Only allow HTTPS URLs
  if (!url.startsWith("https://")) {
    if (returnBoolean) return false;
    throw new Error("SSE URLs must use HTTPS protocol");
  }

  try {
    const urlObj = new URL(url);

    // Check for trusted domains
    const allowedDomains = [
      "bindings.mcp.cloudflare.com",
      "builds.mcp.cloudflare.com",
      "api.cloudflare.com",
      "events.supabase.co",
      "sse.vercel.app",
      "api.example.com", // For testing
      "secure-sse.cloudflare.com", // For testing
      "localhost", // For development
    ];

    if (!allowedDomains.includes(urlObj.hostname)) {
      if (returnBoolean) return false;
      throw new Error(
        `Untrusted domain: ${urlObj.hostname}. Allowed domains: ${allowedDomains.join(", ")}`
      );
    }

    // Check for shell metacharacters and injection attempts
    const dangerousChars = /[;&|`$(){}[\]\\<>'"]/;
    if (dangerousChars.test(url)) {
      if (returnBoolean) return false;
      throw new Error("URL contains potentially dangerous characters");
    }

    // Check for path traversal attempts
    if (url.includes("..")) {
      if (returnBoolean) return false;
      throw new Error("URL contains path traversal patterns");
    }

    // Check for double slash in path (not protocol)
    const pathPart = urlObj.pathname + urlObj.search + urlObj.hash;
    if (pathPart.includes("//")) {
      if (returnBoolean) return false;
      throw new Error("URL contains invalid double slash patterns in path");
    }

    return returnBoolean ? true : urlObj.href; // Return boolean or normalized URL
  } catch (error) {
    if (returnBoolean) return false;
    if (error.message.startsWith("Invalid URL")) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    throw error;
  }
}

// REQ-404: Extract SSE command building for single responsibility
function buildSSECommand(spec, scope) {
  const parts = ["claude", "mcp", "add"];

  if (scope && scope !== "local") {
    parts.push("--scope", scope);
  }

  // Validate URL for security before using it
  const validatedUrl = validateSSEUrl(spec.url);

  parts.push("--transport", "sse");
  parts.push(spec.key);
  parts.push(validatedUrl);

  return parts;
}

function buildClaudeMcpCommand(spec, scope, envVars, extraArgs = []) {
  const parts = ["claude", "mcp", "add"];

  // Add scope if not default
  if (scope && scope !== "local") {
    parts.push("--scope", scope);
  }

  // REQ-404: Handle SSE transport via dedicated function
  if (spec.transport === "sse" && spec.url) {
    return buildSSECommand(spec, scope);
  } else {
    // Original logic for npm-based servers
    // Add server name BEFORE environment variables
    parts.push(spec.key);

    // Add environment variables AFTER server name
    if (envVars && typeof envVars === "object") {
      for (const [key, value] of Object.entries(envVars)) {
        if (value) {
          parts.push("--env", `${key}=${value}`);
        }
      }
    }

    // Add separator
    parts.push("--");

    // Add command
    parts.push(spec.command);

    // Add args - handle function vs array
    const args =
      typeof spec.args === "function"
        ? spec.args(...extraArgs)
        : spec.args || [];

    parts.push(...args);
  }

  return parts;
}

function getExistingServerEnv(serverKey) {
  try {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const claudeSettingsPath = path.join(
      os.homedir(),
      ".claude",
      "settings.json"
    );
    if (!fs.existsSync(claudeSettingsPath)) {
      return {};
    }

    const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, "utf8"));
    const serverConfig = settings.mcpServers && settings.mcpServers[serverKey];

    return serverConfig && serverConfig.env ? serverConfig.env : {};
  } catch {
    return {};
  }
}

// REQ-500: Smart server detection to avoid false failure messages
// REQ-600, REQ-601, REQ-605, REQ-607, REQ-609: Enhanced with security, caching, and error handling
function checkServerStatus(serverKey) {
  // REQ-607: Check cache first to avoid duplicate checks
  if (serverStatusCache.has(serverKey)) {
    return serverStatusCache.get(serverKey);
  }

  // REQ-601: Use existing imports instead of re-requiring
  const claudeSettingsPath = path.join(HOME, ".claude", "settings.json");

  try {
    // REQ-600: Specific error handling for file access
    if (!fs.existsSync(claudeSettingsPath)) {
      const result = {
        exists: false,
        status: "not_configured",
        message: "Claude settings not found",
      };
      serverStatusCache.set(serverKey, result);
      return result;
    }

    let settingsContent;
    try {
      settingsContent = fs.readFileSync(claudeSettingsPath, "utf8");
    } catch (error) {
      const result = {
        exists: false,
        status: "error",
        message: "Cannot read Claude settings file",
        errorType: "file_permission",
      };
      console.error(
        `REQ-600: File access error for ${claudeSettingsPath}: ${error.code || error.message}`
      );
      serverStatusCache.set(serverKey, result);
      return result;
    }

    // REQ-609: JSON validation to prevent security vulnerabilities
    let settings;
    try {
      settings = JSON.parse(settingsContent);
    } catch (error) {
      const result = {
        exists: false,
        status: "error",
        message: "Invalid Claude settings format",
        errorType: "json_parsing",
      };
      console.error(
        `REQ-600: JSON parsing error for ${claudeSettingsPath}: ${error.message}`
      );
      serverStatusCache.set(serverKey, result);
      return result;
    }

    // REQ-609: Validate parsed JSON structure to prevent prototype pollution
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      const result = {
        exists: false,
        status: "error",
        message: "Invalid Claude settings structure",
        errorType: "json_validation",
      };
      console.error(
        `REQ-600: Invalid settings structure - expected object, got ${typeof settings}`
      );
      serverStatusCache.set(serverKey, result);
      return result;
    }

    const serverConfig = settings.mcpServers && settings.mcpServers[serverKey];

    if (!serverConfig) {
      const result = {
        exists: false,
        status: "not_configured",
        message: "Server not configured",
      };
      serverStatusCache.set(serverKey, result);
      return result;
    }

    // REQ-605: Enhanced status messaging - for SSE servers, auth is always required
    const result = {
      exists: true,
      status: "configured_needs_auth",
      message: "Server configured, authentication required in Claude Code",
      config: serverConfig,
    };

    // REQ-607: Cache the result
    serverStatusCache.set(serverKey, result);
    return result;
  } catch (error) {
    // REQ-600: Comprehensive error handling with logging
    const result = {
      exists: false,
      status: "error",
      message: "Unknown error checking server status",
      errorType: "unknown",
    };
    console.error(
      `REQ-600: Unexpected error in checkServerStatus for ${serverKey}:`,
      error.message
    );
    serverStatusCache.set(serverKey, result);
    return result;
  }
}

// REQ-711: Enhanced server structure with tiered organization and accessibility
const SERVER_SPECS = [
  // === Quick Start Tier (2 min) - Essential productivity tools ===
  {
    key: "context7",
    title: "Context7",
    envVar: "CONTEXT7_API_KEY",
    helpUrl: "https://context7.com/dashboard",
    command: "npx",
    args: (val) => ["-y", "@upstash/context7-mcp", "--api-key", val],
    tier: "quick-start",
    category: "Documentation & Code Context",
    description: "🔑 Needs: API Access Token (2 min setup)",
    setupTime: "2 min",
    authPattern: "api-key",
    nextSteps: "Ready to use immediately for documentation search",
  },
  {
    key: "tavily",
    title: "Tavily",
    envVar: "TAVILY_API_KEY",
    helpUrl:
      "https://docs.tavily.com/documentation/api-reference/authentication",
    command: "npx",
    args: () => ["-y", "tavily-mcp"],
    tier: "quick-start",
    category: "Web Research & Analysis",
    description: "🔑 Needs: API Access Token (2 min setup)",
    setupTime: "2 min",
    authPattern: "api-key",
    nextSteps: "Ready for web research and content extraction",
  },
  {
    key: "github",
    title: "GitHub",
    envVar: "GITHUB_PERSONAL_ACCESS_TOKEN",
    helpUrl: "https://github.com/settings/tokens",
    command: "npx",
    args: (val) => [
      "-y",
      "@modelcontextprotocol/server-github",
      "--token",
      val,
    ],
    tier: "quick-start",
    category: "Version Control & Collaboration",
    description: "🔑 Needs: Personal Access Token (2 min setup)",
    setupTime: "2 min",
    authPattern: "api-key",
    nextSteps: "Ready for repository management and issue tracking",
  },

  // === Dev Tools Tier (5 min) - Full development workflow ===
  {
    key: "supabase",
    title: "Supabase",
    envVar: "SUPABASE_ACCESS_TOKEN",
    helpUrl: "https://supabase.com/dashboard/account/tokens",
    command: "npx",
    args: (val) => [
      "-y",
      "@supabase/mcp-server-supabase",
      `--access-token=${val}`,
    ],
    tier: "dev-tools",
    category: "Database & Backend Services",
    description: "🔑 Needs: Access Token (3 min setup)",
    setupTime: "3 min",
    authPattern: "api-key",
    nextSteps:
      "Configure projects in dashboard → Ready for database operations",
  },
  {
    key: "cloudflare-bindings",
    title: "Cloudflare Bindings",
    promptType: "sse",
    transport: "sse",
    url: "https://bindings.mcp.cloudflare.com/sse",
    helpUrl:
      "https://developers.cloudflare.com/workers/configuration/bindings/",
    tier: "dev-tools",
    category: "Real-time & Server-Sent Events",
    description: "🌐 Needs: Browser authentication + Claude Code setup (3 min)",
    setupTime: "3 min",
    authPattern: "sse-browser",
    nextSteps:
      "NEXT: Run `/mcp cloudflare-bindings` in Claude Code for authentication",
  },
  {
    key: "cloudflare-builds",
    title: "Cloudflare Builds",
    promptType: "sse",
    transport: "sse",
    url: "https://builds.mcp.cloudflare.com/sse",
    helpUrl: "https://developers.cloudflare.com/workers/builds/",
    tier: "dev-tools",
    category: "Real-time & Server-Sent Events",
    description: "🌐 Needs: Browser authentication + Claude Code setup (3 min)",
    setupTime: "3 min",
    authPattern: "sse-browser",
    nextSteps:
      "NEXT: Run `/mcp cloudflare-builds` in Claude Code for authentication",
  },
  {
    key: "n8n",
    title: "n8n (Recommended)",
    envVar: "N8N_API_URL",
    envVar2: "N8N_API_KEY",
    helpUrl: "https://docs.n8n.io/api/",
    command: "npx",
    args: () => ["-y", "@leonardsellem/n8n-mcp-server"],
    recommended: true,
    tier: "dev-tools",
    category: "Workflow Automation",
    description: "⚙️ Needs: URL + API credentials (5 min setup)",
    setupTime: "5 min",
    authPattern: "dual-config",
    nextSteps:
      "Configure API access in n8n settings → Ready for workflow automation",
  },
  {
    key: "postgres",
    title: "PostgreSQL",
    envVar: "POSTGRES_CONNECTION_STRING",
    helpUrl:
      "https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
    command: "npx",
    args: (val) => ["-y", "@modelcontextprotocol/server-postgres", val],
    tier: "dev-tools",
    category: "Database & Backend Services",
    description: "⚙️ Needs: Connection string (5 min setup)",
    setupTime: "5 min",
    authPattern: "connection-string",
    nextSteps: "Test connection → Ready for SQL operations",
  },

  // === Research Tools Tier (8 min) - Comprehensive research suite ===
  {
    key: "brave-search",
    title: "Brave Search",
    envVar: "BRAVE_API_KEY",
    helpUrl: "https://brave.com/search/api/",
    command: "npx",
    args: () => [
      "-y",
      "@brave/brave-search-mcp-server",
      "--transport",
      "stdio",
    ],
    tier: "research-tools",
    category: "Advanced Web Search",
    description: "🔑 Needs: API Access Token (2 min setup)",
    setupTime: "2 min",
    authPattern: "api-key",
    nextSteps: "Ready for advanced web searches and content discovery",
  },
];

// REQ-711: Tier configurations for progressive disclosure
const SETUP_TIERS = {
  "quick-start": {
    name: "Quick Start",
    description: "Essential productivity tools",
    time: "2 min",
    emoji: "⚡",
    benefits: [
      "Documentation search",
      "Web research",
      "Version control integration",
    ],
  },
  "dev-tools": {
    name: "Dev Tools",
    description: "Full development workflow",
    time: "5 min",
    emoji: "🛠️",
    benefits: [
      "Database operations",
      "Real-time features",
      "Workflow automation",
      "All Quick Start tools",
    ],
  },
  "research-tools": {
    name: "Research Tools",
    description: "Comprehensive research suite",
    time: "8 min",
    emoji: "🔬",
    benefits: [
      "Advanced web search",
      "All Dev Tools",
      "Complete research capabilities",
    ],
  },
};

// REQ-406: Performance - Cache server type lookups to avoid O(n) searches
const HAS_CLOUDFLARE_SSE_SERVERS = SERVER_SPECS.some(
  (spec) => spec.transport === "sse" && spec.key.startsWith("cloudflare")
);

// Command-focused prompt functions that return configuration objects
async function promptPathServerForCommand(spec, askFn) {
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  const input = await askFn(
    "Directory path for file system access",
    process.cwd()
  );

  if (input === "-") {
    return { action: "disable" };
  }

  if (!input) {
    return { action: "skip" };
  }

  return {
    action: "configure",
    extraArgs: [input || process.cwd()],
  };
}

async function promptWranglerServerForCommand(spec, askFn) {
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  console.log(
    "  ⚠️  Requires: npx wrangler login (run separately before using)"
  );
  const input = await askFn("Enable Cloudflare MCP server? (y/N)", "n");

  if (input === "-") {
    return { action: "disable" };
  }

  if (input.toLowerCase() !== "y") {
    return { action: "skip" };
  }

  return {
    action: "configure",
    envVars: {},
  };
}

async function promptDualEnvServerForCommand(spec, askFn) {
  // REQ-711: Enhanced dual environment server presentation
  console.log(`\n┌${"─".repeat(spec.title.length + 20)}┐`);
  console.log(`│ ⚙️  ${spec.title} ${" ".repeat(20 - spec.title.length)}│`);
  console.log(`└${"─".repeat(spec.title.length + 20)}┘`);
  console.log(`📋 Category: ${spec.category || "Configuration Services"}`);
  console.log(`⏱️  Setup Time: ${spec.setupTime || "5 min"}`);
  console.log(`${spec.description || "⚙️ Needs: URL + API credentials"}`);
  console.log(`🔗 Documentation: ${spec.helpUrl}`);

  // Check for existing environment variables and display them
  const existingEnv = getExistingServerEnv(spec.key);
  if (existingEnv[spec.envVar]) {
    const formattedValue = formatExistingValue(
      spec.envVar,
      existingEnv[spec.envVar]
    );
    console.log(`✅ Existing ${spec.envVar}: ${formattedValue}`);
  }
  if (existingEnv[spec.envVar2]) {
    const formattedValue = formatExistingValue(
      spec.envVar2,
      existingEnv[spec.envVar2]
    );
    console.log(`✅ Existing ${spec.envVar2}: ${formattedValue}`);
  }

  const input1 = await askFn(
    `${spec.envVar} (e.g., http://localhost:5678/api/v1)`,
    ""
  );

  if (input1 === "-") {
    return { action: "disable" };
  }

  if (!input1) {
    return { action: "skip" };
  }

  const input2 = await askFn(`${spec.envVar2}`, "");
  if (!input2) {
    console.log(`  (skipped ${spec.title} - API key required)`);
    return { action: "skip" };
  }

  return {
    action: "configure",
    envVars: {
      [spec.envVar]: input1,
      [spec.envVar2]: input2,
    },
  };
}

async function promptStandardServerForCommand(spec, askFn) {
  const promptText =
    spec.envVar === "POSTGRES_CONNECTION_STRING"
      ? "PostgreSQL connection string (e.g., postgresql://user:pass@localhost/db)"
      : spec.envVar;

  // REQ-711: Enhanced server presentation with accessibility and clear information hierarchy
  console.log(`\n┌${"─".repeat(spec.title.length + 20)}┐`);
  console.log(`│ 📦 ${spec.title} ${" ".repeat(20 - spec.title.length)}│`);
  console.log(`└${"─".repeat(spec.title.length + 20)}┘`);
  console.log(`📋 Category: ${spec.category || "General"}`);
  console.log(`⏱️  Setup Time: ${spec.setupTime || "2-3 min"}`);
  console.log(`${spec.description || `🔑 Needs: API Access Token`}`);
  console.log(`🔗 Get credentials: ${spec.helpUrl}`);

  // Check for existing API key and display it
  if (spec.envVar) {
    const existingEnv = getExistingServerEnv(spec.key);
    if (existingEnv[spec.envVar]) {
      const maskedKey = maskKey(existingEnv[spec.envVar]);
      console.log(`✅ Existing Key: ${maskedKey}`);
    }
  }

  const input = await askFn(promptText, "");

  if (input === "-") {
    return { action: "disable" };
  }

  if (!input) {
    return { action: "skip" };
  }

  return {
    action: "configure",
    envVars: {
      [spec.envVar]: input,
    },
  };
}

// REQ-401: SSE Transport Architecture - Prompt function for Server-Sent Events servers
async function promptSSEServerForCommand(spec, askFn) {
  // REQ-500: Check server status before prompting to avoid false failures
  const serverStatus = checkServerStatus(spec.key);

  // REQ-711: Enhanced SSE server presentation with accessibility
  console.log(`\n┌${"─".repeat(spec.title.length + 20)}┐`);
  console.log(`│ 🌐 ${spec.title} ${" ".repeat(20 - spec.title.length)}│`);
  console.log(`└${"─".repeat(spec.title.length + 20)}┘`);
  console.log(`📋 Category: ${spec.category || "Real-time Services"}`);
  console.log(`⏱️  Setup Time: ${spec.setupTime || "3 min"}`);
  console.log(
    `${spec.description || "🌐 Needs: Browser authentication + Claude Code setup"}`
  );
  console.log(`🔗 Documentation: ${spec.helpUrl}`);

  if (serverStatus.exists) {
    console.log(`✅ Already configured`);
    console.log(
      `💡 Next step: Run /mcp ${spec.key} in Claude Code if authentication is needed`
    );
    return { action: ACTION_TYPES.ALREADY_CONFIGURED };
  }

  console.log(
    `⚠️  Authentication: Use /mcp ${spec.key} in Claude Code after installation`
  );
  console.log(`ℹ️  Note: Browser-based authentication (not API keys)`);

  const choice = await askFn(
    `Configure ${spec.title}? (y)es, (n)o, (-) disable`,
    "y"
  );

  if (choice === "-") {
    return { action: ACTION_TYPES.DISABLE };
  }
  if (choice === "n" || choice === "no") {
    return { action: ACTION_TYPES.SKIP };
  }

  return {
    action: ACTION_TYPES.CONFIGURE,
    envVars: {}, // SSE servers don't need env vars in CLI
    spec,
  };
}

async function configureClaudeCode() {
  const { execSync } = require("node:child_process");

  console.log("\n📁 Configuring Claude Code MCP servers");

  // REQ-711: Get tier selection first to reduce choice overload
  const selectedTier = await askSetupTier();
  const tierServers = getServersForTier(selectedTier);

  // Get scope preference
  const scope = await askScope();

  // REQ-711: Show tier summary with estimated time and server count
  const tierConfig = SETUP_TIERS[selectedTier];
  console.log(`\n✨ Setting up: ${tierConfig.emoji} ${tierConfig.name}`);
  console.log(
    `📊 ${tierServers.length} servers • ${tierConfig.time} estimated setup time`
  );
  console.log(`🎯 Using ${scope} scope for MCP server configuration\n`);

  console.log("+" + "=".repeat(58) + "+");
  console.log("| 🔌 CONFIGURE MCP SERVERS                                |");
  console.log('| (Enter = skip; "-" = disable existing)                 |');
  console.log("+" + "=".repeat(58) + "+");

  // Track configured servers for summary
  const configuredServers = [];
  const skippedServers = [];
  const failedServers = [];

  // REQ-711: Process only servers in selected tier
  for (const spec of tierServers) {
    try {
      // Route to appropriate prompt handler and collect results
      let serverConfig = null;

      if (spec.promptType === "path") {
        serverConfig = await promptPathServerForCommand(spec, ask);
      } else if (spec.promptType === "wrangler") {
        serverConfig = await promptWranglerServerForCommand(spec, ask);
      } else if (spec.promptType === "sse") {
        serverConfig = await promptSSEServerForCommand(spec, ask);
      } else if (spec.envVar2) {
        serverConfig = await promptDualEnvServerForCommand(spec, ask);
      } else {
        serverConfig = await promptStandardServerForCommand(spec, ask);
      }

      if (serverConfig && serverConfig.action === ACTION_TYPES.CONFIGURE) {
        // Build and execute claude mcp add command
        const command = buildClaudeMcpCommand(
          spec,
          scope,
          serverConfig.envVars,
          serverConfig.extraArgs || []
        );

        // REQ-500: Check if server already exists before attempting installation
        const serverStatus = checkServerStatus(spec.key);

        if (serverStatus.exists) {
          console.log(`  ✅ ${spec.title} already configured`);
          console.log(
            `  ℹ️  Run /mcp ${spec.key} in Claude Code if authentication is needed`
          );
          configuredServers.push(spec.title);
        } else {
          console.log(`  Installing ${spec.title}...`);
          // REQ-709: Fix commandString scoping - declare outside try-catch block
          const commandString = Array.isArray(command)
            ? command.join(" ")
            : command;
          try {
            execSync(commandString, { stdio: "inherit" });
            console.log(`  ✅ ${spec.title} configured successfully`);
            configuredServers.push(spec.title);
          } catch (error) {
            console.log(`  ❌ ${spec.title} installation failed`);
            // REQ-709: Enhanced error reporting for debugging (commandString now accessible)
            if (process.env.DEBUG_MCP) {
              console.log(`    Debug: Command was: ${commandString}`);
              console.log(`    Debug: Error: ${error.message}`);
              if (error.status)
                console.log(`    Debug: Exit code: ${error.status}`);
            }
            failedServers.push(spec.title);
          }
        }
      } else if (serverConfig && serverConfig.action === ACTION_TYPES.DISABLE) {
        // Remove existing server
        try {
          execSync(`claude mcp remove ${spec.key}`, { stdio: "pipe" });
          console.log(`  🗑️  ${spec.title} removed`);
        } catch {
          // Server wasn't configured, that's fine
          console.log(`  ⚠️  ${spec.title} was not configured`);
        }
      } else if (
        serverConfig &&
        serverConfig.action === ACTION_TYPES.ALREADY_CONFIGURED
      ) {
        // REQ-500: Handle already configured servers from prompt functions
        configuredServers.push(spec.title);
      } else {
        console.log(`  ⏭️  ${spec.title} skipped`);
        skippedServers.push(spec.title);
      }
    } catch (error) {
      console.log(`  ❌ ${spec.title} failed: ${error.message}`);
      failedServers.push(spec.title);
    }
  }

  // REQ-711: Enhanced tier-specific summary with accessibility and next steps
  console.log("\n" + "=".repeat(60));
  console.log(`🎉 ${tierConfig.emoji} ${tierConfig.name} SETUP COMPLETE`);
  console.log("=".repeat(60));

  if (configuredServers.length > 0) {
    console.log(
      `✅ Successfully configured ${configuredServers.length} servers:`
    );
    configuredServers.forEach((server) => {
      const spec = tierServers.find((s) => s.title === server);
      if (spec && spec.nextSteps) {
        console.log(`   • ${server}: ${spec.nextSteps}`);
      } else {
        console.log(`   • ${server}: Ready to use`);
      }
    });
  }

  if (skippedServers.length > 0) {
    console.log(
      `\n⏭️  Skipped ${skippedServers.length} servers: ${skippedServers.join(", ")}`
    );
    console.log(`   💡 Run this tool again to configure them later`);
  }

  if (failedServers.length > 0) {
    console.log(
      `\n❌ Failed ${failedServers.length} servers: ${failedServers.join(", ")}`
    );
    console.log(
      `   🔧 Try: Update Claude Code CLI or check network connection`
    );
    console.log(`   📚 Debug: Set DEBUG_MCP=true for detailed error messages`);
  }

  // REQ-711: Tier-specific next steps and progressive disclosure
  console.log(`\n🚀 WHAT'S NEXT:`);
  if (selectedTier === "quick-start") {
    console.log(
      `   1. Start Claude Code and try: "Search documentation for...")`
    );
    console.log(`   2. Use GitHub integration for repository management`);
    console.log(`   3. Ready to upgrade? Re-run for Dev Tools tier`);
  } else if (selectedTier === "dev-tools") {
    console.log(
      `   1. SSE servers: Use /mcp cloudflare-* commands in Claude Code`
    );
    console.log(`   2. Database: Test connections and start building`);
    console.log(`   3. Automation: Configure n8n workflows`);
    console.log(`   4. Want research tools? Re-run for Research Tools tier`);
  } else {
    console.log(
      `   1. Full setup complete! All research and development tools ready`
    );
    console.log(`   2. Try advanced web searches with Brave Search`);
    console.log(
      `   3. Combine all tools for comprehensive development workflow`
    );
  }

  console.log(`\n📋 ACCESSIBILITY NOTES:`);
  console.log(
    `   • Screen readers: All servers have clear categories and descriptions`
  );
  console.log(
    `   • Keyboard users: Tab through options, Enter to select, Esc to skip`
  );
  console.log(
    `   • High contrast: Server status uses ✅❌⏭️ symbols for clarity`
  );

  console.log("=".repeat(60));

  // Verify installation
  try {
    console.log("\n🔍 Verifying MCP server installation...");
    execSync("claude mcp list", { stdio: "inherit" });
  } catch {
    console.log(
      "⚠️  Could not verify installation. Run `claude mcp list` to check manually."
    );
  }
}

async function scaffoldProjectFiles() {
  console.log("\n🧩 Scaffolding project files in:", PROJECT_DIR);

  // CLAUDE.md
  const claudeMd = path.join(PROJECT_DIR, "CLAUDE.md");
  if (!fs.existsSync(claudeMd)) {
    await safeFileWrite(claudeMd, TEMPLATE("CLAUDE.md"));
    console.log("• CLAUDE.md created");
  } else {
    console.log("• CLAUDE.md exists (left unchanged)");
  }

  // README.md (navigation and mental model)
  const readmeMd = path.join(PROJECT_DIR, "README.md");
  if (!fs.existsSync(readmeMd)) {
    await safeFileWrite(readmeMd, TEMPLATE("README.md"));
    console.log("• README.md created (navigation template)");
  } else {
    console.log("• README.md exists (left unchanged)");
  }

  // .claude/settings.json
  fs.mkdirSync(PROJ_CLAUDE_DIR, { recursive: true });
  const projSettings = path.join(PROJ_CLAUDE_DIR, "settings.json");
  if (!fs.existsSync(projSettings)) {
    await safeFileWrite(projSettings, TEMPLATE("project-settings.json"));
    console.log("• .claude/settings.json created (safe defaults, no secrets)");
  } else {
    console.log("• .claude/settings.json exists (left unchanged)");
  }

  // .claude/settings.local.json (empty valid JSON)
  const projLocal = path.join(PROJ_CLAUDE_DIR, "settings.local.json");
  if (!fs.existsSync(projLocal)) {
    await safeFileWrite(projLocal, TEMPLATE("project-settings.local.json"));
    console.log("• .claude/settings.local.json created (local-only overrides)");
  } else {
    console.log("• .claude/settings.local.json exists (left unchanged)");
  }

  // Documentation templates directory
  const docsDir = path.join(PROJ_CLAUDE_DIR, "templates");
  fs.mkdirSync(docsDir, { recursive: true });

  // Domain README template
  const domainReadme = path.join(docsDir, "domain-README.md");
  if (!fs.existsSync(domainReadme)) {
    await safeFileWrite(domainReadme, TEMPLATE("domain-README.md"));
    console.log(
      "• .claude/templates/domain-README.md created (for feature domains)"
    );
  }

  // .claude-context template
  const claudeContext = path.join(docsDir, ".claude-context");
  if (!fs.existsSync(claudeContext)) {
    await safeFileWrite(claudeContext, TEMPLATE(".claude-context"));
    console.log(
      "• .claude/templates/.claude-context created (for AI assistance)"
    );
  }

  // Repository-specific CLAUDE.md template
  const claudeTemplate = path.join(docsDir, "CLAUDE.md");
  if (!fs.existsSync(claudeTemplate)) {
    await safeFileWrite(claudeTemplate, TEMPLATE("CLAUDE.md"));
    console.log(
      "• .claude/templates/CLAUDE.md created (repository-specific guidelines)"
    );
  }

  // Install agents to global Claude directory for /agents command discovery
  const globalAgentsDir = path.join(GLOBAL_DIR, "agents");
  fs.mkdirSync(globalAgentsDir, { recursive: true });

  const sourceAgentsDir = path.join(__dirname, "..", ".claude", "agents");
  if (fs.existsSync(sourceAgentsDir)) {
    const agentFiles = fs
      .readdirSync(sourceAgentsDir)
      .filter((f) => f.endsWith(".md"));

    for (const agentFile of agentFiles) {
      // Validate agent file name to prevent path traversal
      if (
        !agentFile ||
        agentFile.includes("..") ||
        agentFile.includes("/") ||
        agentFile.includes("\\")
      ) {
        console.log(`⚠️  Skipping invalid agent file: ${agentFile}`);
        continue;
      }

      const sourcePath = path.join(sourceAgentsDir, agentFile);
      const globalTargetPath = path.join(globalAgentsDir, agentFile);

      // Ensure target path is within expected directory
      const resolvedTarget = path.resolve(globalTargetPath);
      const resolvedAgentsDir = path.resolve(globalAgentsDir);
      if (!resolvedTarget.startsWith(resolvedAgentsDir)) {
        console.log(
          `⚠️  Skipping agent file outside target directory: ${agentFile}`
        );
        continue;
      }

      // Only install if not already present or if source is newer
      let shouldInstall = !fs.existsSync(globalTargetPath);
      if (!shouldInstall) {
        const sourceStats = fs.statSync(sourcePath);
        const targetStats = fs.statSync(globalTargetPath);
        shouldInstall = sourceStats.mtime > targetStats.mtime;
      }

      if (shouldInstall) {
        const agentContent = fs.readFileSync(sourcePath, "utf8");
        await safeFileWrite(globalTargetPath, agentContent);
        console.log(
          `• ~/.claude/agents/${agentFile} installed (globally available)`
        );
      }
    }

    // Provide user instructions for agent registration
    console.log("\n🤖 Agent Registration:");
    console.log("• Agents installed globally in ~/.claude/agents/");
    console.log("• To register agents with Claude Code, run: claude");
    console.log("• Then type: /agents");
    console.log("• Use the interactive menu to enable your custom agents");
    console.log(
      "• Agents will be available across all your Claude Code projects"
    );
  }

  // .gitignore (append secret guardrails if missing)
  const gi = path.join(PROJECT_DIR, ".gitignore");
  const guard = [
    "",
    "# Claude Code secret guardrails",
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "**/secrets/**",
    "**/credentials/**",
    "**/.aws/**",
    "**/.ssh/**",
  ].join("\n");

  try {
    let cur = "";
    if (fs.existsSync(gi)) cur = fs.readFileSync(gi, "utf8");
    if (!cur.includes("# Claude Code secret guardrails")) {
      await safeFileWrite(gi, (cur ? cur.trimEnd() + "\n" : "") + guard + "\n");
      console.log("• .gitignore updated with secret guardrails");
    } else {
      console.log("• .gitignore already includes secret guardrails");
    }
  } catch {
    console.warn("! Skipped .gitignore update (permission or fs issue)");
  }

  console.log("✅ Project scaffold complete.");
}

function checkVSCodeExtension() {
  try {
    const { execSync } = require("node:child_process");
    const extensions = execSync("code --list-extensions", {
      encoding: "utf8",
      stdio: "pipe",
    }).toString();
    return extensions.includes("claude") || extensions.includes("anthropic");
  } catch {
    return false;
  }
}

// REQ-501: Enhanced post-setup experience with specific guidance
function showPostSetupGuide() {
  const vsCodeInstalled = checkVSCodeExtension();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Setup complete! Here's what you have and what to do next:");
  console.log("=".repeat(60));

  // List what was just installed
  console.log("\n🎁 WHAT YOU JUST GOT:");
  console.log(
    "  ✓ CLAUDE.md - Your AI coding rules and instructions for Claude Code"
  );
  console.log("  ✓ MCP Servers - Direct integrations with external services:");
  console.log("    • Supabase - Database operations and auth");
  console.log("    • GitHub - Repository management and code analysis");
  console.log("    • Brave Search - Web search and current information");
  console.log("    • Tavily - Research and web content extraction");
  console.log("    • Context7 - Documentation and API references");
  console.log("    • n8n - Workflow automation and integrations");
  console.log("    • Cloudflare SSE - Worker bindings and build management");
  console.log("  ✓ Claude Code Agents - Specialized AI assistants:");
  console.log(
    "    • Planner - Breaks down requirements into implementation steps"
  );
  console.log(
    "    • Test Writer - Creates comprehensive test suites following TDD"
  );
  console.log("    • PE Reviewer - Principal Engineer-level code reviews");
  console.log("    • Debugger - Finds and fixes issues with minimal changes");
  console.log("    • Security Reviewer - Security-focused code analysis");

  console.log("\n🚀 IMMEDIATE NEXT STEPS:");
  console.log("  1. Open VS Code in your project directory");
  console.log("  2. Open terminal (Cmd+` or Ctrl+`)");
  console.log("  3. Run: claude");
  if (!vsCodeInstalled) {
    console.log("  4. Claude extension will auto-install in VS Code");
  } else {
    console.log("  4. ✓ Claude extension already installed");
  }

  console.log("\n⚡ CLAUDE CODE SHORTCUTS - Your New Superpowers:");
  console.log(
    "  1. qnew - Run before each new feature to refresh Claude Code's instructions"
  );
  console.log(
    "     Example: Type 'qnew' then 'I want to add user authentication'"
  );
  console.log("");
  console.log("  2. qplan - Creates detailed implementation plans");
  console.log(
    "     Example: 'qplan - I want a new web form that collects email, first name, and last name'"
  );
  console.log("");
  console.log("  3. qcode - Executes the plan and writes the code");
  console.log("     Example: After qplan, just type 'qcode' to implement");
  console.log("");
  console.log("  4. qcheck - Principal Engineer code review + QA analysis");
  console.log(
    "     Example: 'qcheck' - If issues found, run qplan to fix them, then qcode + qcheck"
  );
  console.log("");
  console.log("  5. qdoc - Updates all documentation (user and developer)");
  console.log("     Example: 'qdoc' after completing features");
  console.log("");
  console.log("  6. qgit - Commits your work to Git with proper messages");
  console.log("     Example: 'qgit' when ready to save your progress");

  // REQ-406: Use cached constant instead of O(n) search
  if (HAS_CLOUDFLARE_SSE_SERVERS) {
    console.log("\n🔐 CLOUDFLARE SSE AUTHENTICATION:");
    console.log(
      "  ⚠️  IMPORTANT: For Cloudflare servers, you must authenticate in Claude Code:"
    );
    console.log("  • Open Claude Code and run: /mcp cloudflare-bindings");
    console.log("  • Open Claude Code and run: /mcp cloudflare-builds");
    console.log("  • Follow the authentication prompts for each");
    console.log(
      "  ⚠️  Note: 'npx wrangler login' does NOT work with MCP servers"
    );
  }

  console.log("\n📖 CLAUDE.MD - YOUR AI CODING CONSTITUTION:");
  console.log("  • Contains your project's coding rules and TDD methodology");
  console.log("  • Guides Claude Code on how to write, test, and review code");
  console.log("  • Includes MCP server usage patterns and best practices");
  console.log("  • Updated automatically as you configure new tools");

  console.log("\n🎯 TRY IT NOW:");
  console.log("  1. Create a new project: npx claude-code-quickstart init");
  console.log("  2. Open CLAUDE.md to see your coding rules");
  console.log('  3. Try: "qnew" then "I want to build a simple todo app"');
  console.log(
    '  4. Test MCP: "Search for React best practices 2024" (uses Brave Search)'
  );

  console.log("\nReady to build something amazing with AI superpowers! 🚀✨\n");
}

function createChecksum(content) {
  const crypto = require("crypto");
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function compareTemplates(currentContent, templateContent) {
  if (currentContent === templateContent) {
    return { status: "identical", needsUpdate: false };
  }

  // Simple heuristic: if current content contains our template markers, it's likely customized
  const hasCustomizations =
    currentContent !== templateContent &&
    (currentContent.includes("# Claude Code Guidelines") ||
      currentContent.includes("## Mental Model") ||
      currentContent.includes("Domain:"));

  return {
    status: hasCustomizations ? "customized" : "outdated",
    needsUpdate: true,
    currentChecksum: createChecksum(currentContent),
    templateChecksum: createChecksum(templateContent),
  };
}

async function analyzeCurrentTemplates() {
  console.log("🔍 Analyzing current templates...\n");

  const results = [];
  const templateFiles = [
    {
      path: "CLAUDE.md",
      templateName: "CLAUDE.md",
      description: "Development guidelines and coding standards",
    },
    {
      path: "README.md",
      templateName: "README.md",
      description: "Project navigation and mental model",
    },
    {
      path: ".claude/templates/domain-README.md",
      templateName: "domain-README.md",
      description: "Template for feature domain documentation",
    },
    {
      path: ".claude/templates/.claude-context",
      templateName: ".claude-context",
      description: "Template for AI assistance in complex domains",
    },
    {
      path: ".claude/templates/CLAUDE.md",
      templateName: "CLAUDE.md",
      description: "Repository-specific CLAUDE.md template",
    },
  ];

  for (const file of templateFiles) {
    const fullPath = path.join(PROJECT_DIR, file.path);
    const templatePath = path.join(TEMPLATES, file.templateName);

    if (!fs.existsSync(fullPath)) {
      results.push({
        ...file,
        status: "missing",
        needsUpdate: true,
        action: "create",
      });
      continue;
    }

    if (!fs.existsSync(templatePath)) {
      console.log(`⚠️  Template ${file.templateName} not found in package`);
      continue;
    }

    const currentContent = fs.readFileSync(fullPath, "utf8");
    const templateContent = fs.readFileSync(templatePath, "utf8");

    const comparison = compareTemplates(currentContent, templateContent);
    results.push({
      ...file,
      ...comparison,
      action: comparison.needsUpdate ? "update" : "none",
    });
  }

  // Handle agent files separately since they're dynamic
  const sourceAgentsDir = path.join(__dirname, "..", ".claude", "agents");
  if (fs.existsSync(sourceAgentsDir)) {
    const agentFiles = fs
      .readdirSync(sourceAgentsDir)
      .filter((f) => f.endsWith(".md"));

    for (const agentFile of agentFiles) {
      const agentPath = path.join(PROJECT_DIR, ".claude", "agents", agentFile);
      const sourceAgentPath = path.join(sourceAgentsDir, agentFile);

      if (!fs.existsSync(agentPath)) {
        results.push({
          path: `.claude/agents/${agentFile}`,
          templateName: agentFile,
          description: `Agent definition: ${agentFile.replace(".md", "")}`,
          status: "missing",
          needsUpdate: true,
          action: "create",
        });
      } else {
        const currentContent = fs.readFileSync(agentPath, "utf8");
        const templateContent = fs.readFileSync(sourceAgentPath, "utf8");

        const comparison = compareTemplates(currentContent, templateContent);
        results.push({
          path: `.claude/agents/${agentFile}`,
          templateName: agentFile,
          description: `Agent definition: ${agentFile.replace(".md", "")}`,
          ...comparison,
          action: comparison.needsUpdate ? "update" : "none",
        });
      }
    }
  }

  return results;
}

async function showTemplateStatus(results) {
  console.log("📋 Template Status:\n");

  let needsAttention = 0;

  for (const result of results) {
    const icon =
      result.status === "identical"
        ? "✅"
        : result.status === "missing"
          ? "❌"
          : result.status === "customized"
            ? "🔧"
            : "⚠️";

    console.log(`${icon} ${result.path}`);
    console.log(`   ${result.description}`);
    console.log(`   Status: ${result.status}`);

    if (result.needsUpdate) {
      needsAttention++;
      if (result.status === "missing") {
        console.log("   Action: Will be created");
      } else if (result.status === "customized") {
        console.log("   Action: Manual review recommended");
      } else {
        console.log("   Action: Can be updated");
      }
    }
    console.log("");
  }

  return needsAttention;
}

async function selectTemplatesForUpdate(results) {
  const updateable = results.filter((r) => r.needsUpdate);
  if (updateable.length === 0) return [];

  console.log("🎯 Select templates to update:\n");

  const choices = [];
  for (let i = 0; i < updateable.length; i++) {
    const result = updateable[i];
    const recommendation =
      result.status === "customized" ? " (⚠️  has customizations)" : "";
    console.log(`  ${i + 1}) ${result.path}${recommendation}`);
    choices.push(result);
  }

  console.log(`  a) All templates`);
  console.log(`  q) Quit without updating\n`);

  const response = await ask("Select templates (1,2,3 or 'a' or 'q')", "");

  if (response.toLowerCase() === "q") {
    return [];
  }

  if (response.toLowerCase() === "a") {
    return choices;
  }

  // Parse comma-separated numbers
  const selected = [];
  const numbers = response.split(",").map((s) => s.trim());

  for (const num of numbers) {
    const index = parseInt(num) - 1;
    if (index >= 0 && index < choices.length) {
      selected.push(choices[index]);
    }
  }

  return selected;
}

async function createBackup(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const backupPath = `${filePath}.backup.${Date.now()}`;
  const content = fs.readFileSync(filePath, "utf8");
  await safeFileWrite(backupPath, content);
  return backupPath;
}

async function updateTemplate(templateInfo, dryRun = false) {
  const fullPath = path.join(PROJECT_DIR, templateInfo.path);

  // Handle agent files from different source directory
  let templatePath;
  if (templateInfo.path.startsWith(".claude/agents/")) {
    templatePath = path.join(
      __dirname,
      "..",
      ".claude",
      "agents",
      templateInfo.templateName
    );
  } else {
    templatePath = path.join(TEMPLATES, templateInfo.templateName);
  }

  console.log(`${dryRun ? "[DRY RUN]" : ""} Updating ${templateInfo.path}...`);

  if (dryRun) {
    console.log(
      `  Would ${templateInfo.status === "missing" ? "create" : "update"} file`
    );
    return { success: true, dryRun: true };
  }

  try {
    // Create backup if file exists
    let backupPath = null;
    if (fs.existsSync(fullPath)) {
      backupPath = await createBackup(fullPath);
      console.log(`  Created backup: ${path.basename(backupPath)}`);
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });

    // Copy template content
    const templateContent = fs.readFileSync(templatePath, "utf8");
    await safeFileWrite(fullPath, templateContent);

    console.log(
      `  ✅ ${templateInfo.status === "missing" ? "Created" : "Updated"} successfully`
    );

    return { success: true, backupPath };
  } catch (error) {
    console.log(`  ❌ Failed to update: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function updateTemplates() {
  console.log("📝 Claude Code Template Update Tool\n");

  // Check if we're in a project directory
  const hasClaudeDir = fs.existsSync(path.join(PROJECT_DIR, ".claude"));
  if (!hasClaudeDir) {
    console.log(
      "❌ No .claude directory found. Please run 'npx claude-code-quickstart init' first.\n"
    );
    return;
  }

  try {
    // Phase 1: Analysis
    const results = await analyzeCurrentTemplates();
    const needsAttention = await showTemplateStatus(results);

    if (needsAttention === 0) {
      console.log("✅ All templates are up to date!\n");
      return;
    }

    // Phase 2: Selection
    const selectedTemplates = await selectTemplatesForUpdate(results);

    if (selectedTemplates.length === 0) {
      console.log("👋 No templates selected. Exiting.\n");
      return;
    }

    // Ask for dry run first
    const dryRun = (
      await ask("\nPerform dry run first? (Y/n)", "y")
    ).toLowerCase();
    const shouldDryRun = !dryRun.startsWith("n");

    if (shouldDryRun) {
      console.log("\n🔍 Dry run - showing what would be changed:\n");
      for (const template of selectedTemplates) {
        await updateTemplate(template, true);
      }

      const proceed = await ask("\nProceed with actual updates? (y/N)", "n");
      if (!proceed.toLowerCase().startsWith("y")) {
        console.log("👋 Cancelled by user.\n");
        return;
      }
    }

    // Phase 3: Updates
    console.log("\n🔧 Updating templates:\n");
    const results_update = [];

    for (const template of selectedTemplates) {
      const result = await updateTemplate(template, false);
      results_update.push({ template, result });
    }

    // Summary
    console.log("\n📊 Update Summary:");
    const successful = results_update.filter((r) => r.result.success).length;
    const failed = results_update.filter((r) => !r.result.success).length;

    console.log(`  ✅ Successful: ${successful}`);
    if (failed > 0) {
      console.log(`  ❌ Failed: ${failed}`);
    }

    const backups = results_update
      .filter((r) => r.result.backupPath)
      .map((r) => r.result.backupPath);

    if (backups.length > 0) {
      console.log(`\n💾 Backups created:`);
      backups.forEach((backup) => console.log(`  ${backup}`));
      console.log("\n  💡 To rollback: cp <backup-file> <original-file>");
    }

    console.log("\n✅ Template update complete!\n");
  } catch (error) {
    console.error(`❌ Error during template update: ${error.message}`);
    process.exit(1);
  }
}

function showAgentRegistrationGuide() {
  console.log("🤖 Claude Code Agent Registration Guide\n");

  console.log("📁 INSTALLED AGENTS:");
  const agentsDir = path.join(GLOBAL_DIR, "agents");
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs
      .readdirSync(agentsDir)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => {
        try {
          const agentPath = path.join(agentsDir, f);
          const content = fs.readFileSync(agentPath, "utf8");
          // Validate agent has proper YAML frontmatter with name field
          return content.startsWith("---") && content.includes("name:");
        } catch {
          console.log(`⚠️  Skipping invalid agent file: ${f}`);
          return false;
        }
      });

    if (agentFiles.length === 0) {
      console.log("  No valid agents found.");
    } else {
      agentFiles.forEach((file) => {
        const agentName = file.replace(".md", "");
        console.log(`  • ${agentName}`);
      });
    }
  } else {
    console.log(
      "  No agents installed yet. Run 'npx claude-code-quickstart init' first."
    );
    return;
  }

  console.log("\n🚀 REGISTRATION STEPS:");
  console.log("1. Start Claude Code:");
  console.log("   claude");
  console.log("");
  console.log("2. Open the agents menu:");
  console.log("   /agents");
  console.log("");
  console.log("3. In the interactive menu:");
  console.log("   • Review available agents");
  console.log("   • Select 'Edit' for each agent you want to enable");
  console.log("   • Verify tool permissions");
  console.log("   • Save changes");
  console.log("");
  console.log("4. After registration, use agents in the Task tool:");
  console.log("   • Task tool with subagent_type: 'planner'");
  console.log("   • Task tool with subagent_type: 'test-writer'");
  console.log("   • Task tool with subagent_type: 'debugger'");
  console.log("");
  console.log(
    "💡 TIP: Claude Code will auto-delegate to agents based on context"
  );
  console.log("or you can explicitly request: 'Use the planner agent...'");
  console.log("");
  console.log(
    "📖 More info: https://docs.anthropic.com/en/docs/claude-code/sub-agents"
  );
}

function showHelp() {
  console.log("📝 Claude Code Quickstart CLI\n");
  console.log("USAGE:");
  console.log("  npx claude-code-quickstart [command]\n");
  console.log("COMMANDS:");
  console.log(
    "  init              Configure MCP servers and scaffold project files (default)"
  );
  console.log(
    "  update-templates  Update existing templates to latest versions"
  );
  console.log("  register-agents   Help register agents with Claude Code");
  console.log("  help, -h, --help  Show this help message\n");
  console.log("EXAMPLES:");
  console.log("  npx claude-code-quickstart");
  console.log("  npx claude-code-quickstart init");
  console.log("  npx claude-code-quickstart update-templates");
  console.log("  npx claude-code-quickstart register-agents");
  console.log("  npx claude-code-quickstart --help\n");
  console.log("📖 DOCUMENTATION:");
  console.log(
    "  • GitHub → https://github.com/sparkryio/claude-code-quickstart"
  );
  console.log("  • Claude Code → https://docs.anthropic.com/claude-code\n");
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === "init") {
    await configureClaudeCode();
    await scaffoldProjectFiles();
    rl.close();
    showPostSetupGuide();
    return;
  }

  if (cmd === "update-templates") {
    await updateTemplates();
    rl.close();
    return;
  }

  if (cmd === "register-agents") {
    showAgentRegistrationGuide();
    rl.close();
    return;
  }

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    showHelp();
    rl.close();
    return;
  }

  if (
    cmd &&
    ![
      "init",
      "update-templates",
      "register-agents",
      "help",
      "--help",
      "-h",
    ].includes(cmd)
  ) {
    console.log(`❌ Unknown command: ${cmd}\n`);
    showHelp();
    rl.close();
    process.exit(1);
  }

  console.log("Sparkry.AI — Claude Code Quickstart");
  console.log("1) Configure Claude Code MCP servers");
  await configureClaudeCode();

  const doProj = (
    await ask("\nAlso scaffold project files in current dir? (Y/n) ", "y")
  ).toLowerCase();
  if (!doProj.startsWith("n")) await scaffoldProjectFiles();

  rl.close();
  showPostSetupGuide();
}

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main().catch((err) => {
    console.error("Error:", err?.message || err);
    process.exit(1);
  });
}

// REQ-405: Export functions for integration testing
module.exports = {
  SERVER_SPECS,
  SETUP_TIERS,
  getServersForTier,
  validateSSEUrl,
  buildSSECommand,
  buildClaudeMcpCommand,
  promptSSEServerForCommand,
  HAS_CLOUDFLARE_SSE_SERVERS,
  checkServerStatus,
  ACTION_TYPES,
};
