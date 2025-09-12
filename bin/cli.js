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

const HOME = os.homedir();
const GLOBAL_DIR = path.join(HOME, ".claude");

const PROJECT_DIR = process.cwd();
const PROJ_CLAUDE_DIR = path.join(PROJECT_DIR, ".claude");

const TEMPLATES = path.join(__dirname, "..", "templates");
const TEMPLATE = (f) => fs.readFileSync(path.join(TEMPLATES, f), "utf8");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function ask(q, def = "") {
  const prompt = def ? `${q} [${def}] ` : `${q} `;
  return new Promise((res) =>
    rl.question(prompt, (a) => res((a || "").trim()))
  );
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
function validateSSEUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("SSE URL must be a non-empty string");
  }

  // Only allow HTTPS URLs
  if (!url.startsWith("https://")) {
    throw new Error("SSE URLs must use HTTPS protocol");
  }

  try {
    const urlObj = new URL(url);

    // Check for trusted domains
    const allowedDomains = [
      "bindings.mcp.cloudflare.com",
      "builds.mcp.cloudflare.com",
      "localhost", // For development
    ];

    if (!allowedDomains.includes(urlObj.hostname)) {
      throw new Error(
        `Untrusted domain: ${urlObj.hostname}. Allowed domains: ${allowedDomains.join(", ")}`
      );
    }

    // Check for shell metacharacters and injection attempts
    const dangerousChars = /[;&|`$(){}[\]\\<>'"]/;
    if (dangerousChars.test(url)) {
      throw new Error("URL contains potentially dangerous characters");
    }

    // Check for path traversal attempts
    if (url.includes("..")) {
      throw new Error("URL contains path traversal patterns");
    }

    // Check for double slash in path (not protocol)
    const pathPart = urlObj.pathname + urlObj.search + urlObj.hash;
    if (pathPart.includes("//")) {
      throw new Error("URL contains invalid double slash patterns in path");
    }

    return urlObj.href; // Return normalized URL
  } catch (error) {
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

  return parts.join(" ");
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

  return parts.join(" ");
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
function checkServerStatus(serverKey) {
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
      return { exists: false, status: "not_configured" };
    }

    const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, "utf8"));
    const serverConfig = settings.mcpServers && settings.mcpServers[serverKey];

    if (!serverConfig) {
      return { exists: false, status: "not_configured" };
    }

    return {
      exists: true,
      status: "configured",
      config: serverConfig,
    };
  } catch {
    return { exists: false, status: "error" };
  }
}

// REQ-407: Organize SERVER_SPECS by server type for better maintainability
const SERVER_SPECS = [
  // === NPM-based MCP servers with API keys ===
  {
    key: "context7",
    title: "Context7",
    envVar: "CONTEXT7_API_KEY",
    helpUrl: "https://context7.com/dashboard",
    // correct package name per upstream
    command: "npx",
    args: (val) => ["-y", "@upstash/context7-mcp", "--api-key", val],
  },
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
  },
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
  },
  {
    key: "tavily",
    title: "Tavily",
    envVar: "TAVILY_API_KEY",
    helpUrl:
      "https://docs.tavily.com/documentation/api-reference/authentication",
    command: "npx",
    args: () => ["-y", "tavily-mcp"],
  },
  {
    key: "postgres",
    title: "PostgreSQL",
    envVar: "POSTGRES_CONNECTION_STRING",
    helpUrl:
      "https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
    command: "npx",
    args: (val) => ["-y", "@modelcontextprotocol/server-postgres", val],
  },

  // === NPM-based MCP servers with dual environment variables ===
  {
    key: "n8n",
    title: "n8n (Recommended)",
    envVar: "N8N_API_URL",
    envVar2: "N8N_API_KEY",
    helpUrl: "https://docs.n8n.io/api/",
    command: "npx",
    args: () => ["-y", "@leonardsellem/n8n-mcp-server"],
    recommended: true,
  },

  // === SSE transport servers requiring Claude Code authentication ===
  {
    key: "cloudflare-bindings",
    title: "Cloudflare Bindings",
    promptType: "sse",
    transport: "sse",
    url: "https://bindings.mcp.cloudflare.com/sse",
    helpUrl:
      "https://developers.cloudflare.com/workers/configuration/bindings/",
  },
  {
    key: "cloudflare-builds",
    title: "Cloudflare Builds",
    promptType: "sse",
    transport: "sse",
    url: "https://builds.mcp.cloudflare.com/sse",
    helpUrl: "https://developers.cloudflare.com/workers/builds/",
  },
];

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
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);

  // Check for existing environment variables and display them
  const existingEnv = getExistingServerEnv(spec.key);
  if (existingEnv[spec.envVar]) {
    const formattedValue = formatExistingValue(
      spec.envVar,
      existingEnv[spec.envVar]
    );
    console.log(`Existing ${spec.envVar}: ${formattedValue}`);
  }
  if (existingEnv[spec.envVar2]) {
    const formattedValue = formatExistingValue(
      spec.envVar2,
      existingEnv[spec.envVar2]
    );
    console.log(`Existing ${spec.envVar2}: ${formattedValue}`);
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

  console.log(
    `\n• ${spec.title} ${spec.envVar ? "API key" : ""} → ${spec.helpUrl}`
  );

  // Check for existing API key and display it
  if (spec.envVar) {
    const existingEnv = getExistingServerEnv(spec.key);
    if (existingEnv[spec.envVar]) {
      const maskedKey = maskKey(existingEnv[spec.envVar]);
      console.log(`Existing Key: ${maskedKey}`);
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

  if (serverStatus.exists) {
    console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
    console.log(`  ✅ Already configured`);
    console.log(
      `  ℹ️  Run /mcp ${spec.key} in Claude Code if authentication is needed`
    );
    return { action: "already_configured" };
  }

  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  console.log(
    `  ⚠️  Note: You'll need to authenticate in Claude Code using /mcp ${spec.key}`
  );
  console.log(
    `  ⚠️  Note: SSE-based MCP servers require authentication via Claude Code, not wrangler login`
  );

  const choice = await askFn(
    `Configure ${spec.title}? (y)es, (n)o, (-) disable`,
    "y"
  );

  if (choice === "-") {
    return { action: "disable" };
  }
  if (choice === "n" || choice === "no") {
    return { action: "skip" };
  }

  return {
    action: "configure",
    envVars: {}, // SSE servers don't need env vars in CLI
    spec,
  };
}

async function configureClaudeCode() {
  const { execSync } = require("node:child_process");

  console.log("\n📁 Configuring Claude Code MCP servers");

  // Get scope preference
  const scope = await askScope();
  console.log(`\nUsing ${scope} scope for MCP server configuration\n`);

  console.log(
    '🔌 Configure MCP servers (Enter = skip; "-" = disable existing)'
  );

  // Track configured servers for summary
  const configuredServers = [];
  const skippedServers = [];
  const failedServers = [];

  for (const spec of SERVER_SPECS) {
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

      if (serverConfig && serverConfig.action === "configure") {
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
          try {
            execSync(command, { stdio: "inherit" });
            console.log(`  ✅ ${spec.title} configured successfully`);
            configuredServers.push(spec.title);
          } catch {
            console.log(`  ❌ ${spec.title} installation failed`);
            failedServers.push(spec.title);
          }
        }
      } else if (serverConfig && serverConfig.action === "disable") {
        // Remove existing server
        try {
          execSync(`claude mcp remove ${spec.key}`, { stdio: "pipe" });
          console.log(`  🗑️  ${spec.title} removed`);
        } catch {
          // Server wasn't configured, that's fine
          console.log(`  ⚠️  ${spec.title} was not configured`);
        }
      } else if (serverConfig && serverConfig.action === "already_configured") {
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

  // Show summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Configuration Summary:");
  if (configuredServers.length > 0) {
    console.log(`  ✅ Configured: ${configuredServers.join(", ")}`);
  }
  if (skippedServers.length > 0) {
    console.log(`  ⏭️  Skipped: ${skippedServers.join(", ")}`);
  }
  if (failedServers.length > 0) {
    console.log(`  ❌ Failed: ${failedServers.join(", ")}`);
  }
  console.log("=".repeat(50));

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

function scaffoldProjectFiles() {
  console.log("\n🧩 Scaffolding project files in:", PROJECT_DIR);

  // CLAUDE.md
  const claudeMd = path.join(PROJECT_DIR, "CLAUDE.md");
  if (!fs.existsSync(claudeMd)) {
    fs.writeFileSync(claudeMd, TEMPLATE("CLAUDE.md"), "utf8");
    console.log("• CLAUDE.md created");
  } else {
    console.log("• CLAUDE.md exists (left unchanged)");
  }

  // README.md (navigation and mental model)
  const readmeMd = path.join(PROJECT_DIR, "README.md");
  if (!fs.existsSync(readmeMd)) {
    fs.writeFileSync(readmeMd, TEMPLATE("README.md"), "utf8");
    console.log("• README.md created (navigation template)");
  } else {
    console.log("• README.md exists (left unchanged)");
  }

  // .claude/settings.json
  fs.mkdirSync(PROJ_CLAUDE_DIR, { recursive: true });
  const projSettings = path.join(PROJ_CLAUDE_DIR, "settings.json");
  if (!fs.existsSync(projSettings)) {
    fs.writeFileSync(projSettings, TEMPLATE("project-settings.json"), "utf8");
    console.log("• .claude/settings.json created (safe defaults, no secrets)");
  } else {
    console.log("• .claude/settings.json exists (left unchanged)");
  }

  // .claude/settings.local.json (empty valid JSON)
  const projLocal = path.join(PROJ_CLAUDE_DIR, "settings.local.json");
  if (!fs.existsSync(projLocal)) {
    fs.writeFileSync(
      projLocal,
      TEMPLATE("project-settings.local.json"),
      "utf8"
    );
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
    fs.writeFileSync(domainReadme, TEMPLATE("domain-README.md"), "utf8");
    console.log(
      "• .claude/templates/domain-README.md created (for feature domains)"
    );
  }

  // .claude-context template
  const claudeContext = path.join(docsDir, ".claude-context");
  if (!fs.existsSync(claudeContext)) {
    fs.writeFileSync(claudeContext, TEMPLATE(".claude-context"), "utf8");
    console.log(
      "• .claude/templates/.claude-context created (for AI assistance)"
    );
  }

  // Repository-specific CLAUDE.md template
  const claudeTemplate = path.join(docsDir, "CLAUDE.md");
  if (!fs.existsSync(claudeTemplate)) {
    fs.writeFileSync(claudeTemplate, TEMPLATE("CLAUDE.md"), "utf8");
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
        fs.writeFileSync(globalTargetPath, agentContent, "utf8");
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
      fs.writeFileSync(
        gi,
        (cur ? cur.trimEnd() + "\n" : "") + guard + "\n",
        "utf8"
      );
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
  fs.writeFileSync(backupPath, content, "utf8");
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
    fs.writeFileSync(fullPath, templateContent, "utf8");

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
    scaffoldProjectFiles();
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
  if (!doProj.startsWith("n")) scaffoldProjectFiles();

  rl.close();
  showPostSetupGuide();
}

main().catch((err) => {
  console.error("Error:", err?.message || err);
  process.exit(1);
});

// REQ-405: Export functions for integration testing
module.exports = {
  SERVER_SPECS,
  validateSSEUrl,
  buildSSECommand,
  buildClaudeMcpCommand,
  promptSSEServerForCommand,
  HAS_CLOUDFLARE_SSE_SERVERS,
};
