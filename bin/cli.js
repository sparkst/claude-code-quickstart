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

function ensureServersPreserved(existing) {
  const out = existing && typeof existing === "object" ? { ...existing } : {};
  out.mcpServers =
    out.mcpServers && typeof out.mcpServers === "object"
      ? { ...out.mcpServers }
      : {};
  return out;
}

function buildClaudeMcpCommand(spec, scope, envVars, extraArgs = []) {
  const parts = ["claude", "mcp", "add"];

  // Add scope if not default
  if (scope && scope !== "local") {
    parts.push("--scope", scope);
  }

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
    typeof spec.args === "function" ? spec.args(...extraArgs) : spec.args || [];

  parts.push(...args);

  return parts.join(" ");
}

function checkMcpServerExists(serverKey) {
  try {
    const result = execSync("claude mcp list", {
      encoding: "utf8",
      stdio: "pipe",
    });
    // Parse the text output to find the server
    // Format: "server-name: command - ✓ Connected" or "server-name: command - ✗ Failed"
    const lines = result.split("\n");
    for (const line of lines) {
      if (line.startsWith(serverKey + ":")) {
        return true;
      }
    }
    return false;
  } catch (error) {
    // If we can't check, assume it doesn't exist
    return false;
  }
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
  } catch (error) {
    return {};
  }
}

async function handleExistingServer(spec, askFn) {
  // Get existing environment variables to show user what's configured
  const existingEnv = getExistingServerEnv(spec.key);

  console.log(`  ⚠️  ${spec.title} is already configured`);

  // Show existing API key(s) masked
  if (spec.envVar && existingEnv[spec.envVar]) {
    const maskedKey = maskKey(existingEnv[spec.envVar]);
    console.log(`     Current ${spec.envVar}: ${maskedKey}`);
  }
  if (spec.envVar2 && existingEnv[spec.envVar2]) {
    const maskedKey = maskKey(existingEnv[spec.envVar2]);
    console.log(`     Current ${spec.envVar2}: ${maskedKey}`);
  }

  const choice = await askFn(
    `What would you like to do? (k)eep existing, (r)emove and reinstall, (s)kip`,
    "k"
  );

  switch (choice.toLowerCase()) {
    case "r":
    case "remove":
      console.log(`  🗑️  Removing existing ${spec.title}...`);
      try {
        execSync(`claude mcp remove ${spec.key}`, { stdio: "pipe" });
        console.log(`  ✅ ${spec.title} removed successfully`);
        return "reinstall";
      } catch (error) {
        console.log(`  ❌ Failed to remove ${spec.title}: ${error.message}`);
        return "skip";
      }
    case "s":
    case "skip":
      return "skip";
    case "k":
    case "keep":
    default:
      return "keep";
  }
}

const SERVER_SPECS = [
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
    args: () => ["-y", "@brave/brave-search-mcp-server"],
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
    args: () => ["-y", "@tavily/mcp"],
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
  {
    key: "cloudflare",
    title: "Cloudflare",
    promptType: "wrangler",
    helpUrl:
      "https://developers.cloudflare.com/workers/wrangler/install-and-update/",
    command: "npx",
    args: () => ["-y", "@cloudflare/mcp-server-cloudflare", "init"],
  },
];

async function promptPathServer(spec, servers, askFn) {
  const existingEntry = servers[spec.key] || {};
  const currentPath =
    (existingEntry.args && existingEntry.args[2]) || process.cwd();
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  const input = await askFn(
    "Directory path for file system access",
    currentPath
  );

  if (!input || input === currentPath) {
    if (existingEntry.command) {
      console.log(`  (kept existing ${spec.title} path: ${currentPath})`);
      return;
    }
  }

  if (input === "-") {
    if (servers[spec.key]) {
      delete servers[spec.key];
      console.log(`  (disabled ${spec.title})`);
    }
    return;
  }

  const path = input || currentPath;
  servers[spec.key] = {
    command: spec.command,
    args: spec.args(path),
  };
  console.log(`  (configured ${spec.title} with path: ${path})`);
}

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

async function promptWranglerServer(spec, servers, askFn) {
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  console.log(
    "  ⚠️  Requires: npx wrangler login (run separately before using)"
  );
  const input = await askFn("Enable Cloudflare MCP server? (y/N)", "n");

  if (input.toLowerCase() !== "y") {
    if (servers[spec.key]) delete servers[spec.key];
    console.log(`  (skipped ${spec.title})`);
    return;
  }

  servers[spec.key] = {
    command: spec.command,
    args: spec.args(),
  };
  console.log(
    `  (enabled ${spec.title} - remember to run: npx wrangler login)`
  );
}

async function promptDualEnvServer(spec, servers, existingEnv, askFn) {
  const currentVal1 = existingEnv[spec.envVar] || "";
  const currentVal2 = existingEnv[spec.envVar2] || "";
  const shown1 = currentVal1 || "";
  const shown2 = currentVal2 ? maskKey(currentVal2) : "";

  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  const input1 = await askFn(
    `${spec.envVar} (e.g., http://localhost:5678/api/v1)`,
    shown1
  );

  if (!input1) {
    if (currentVal1 && currentVal2) {
      console.log(`  (kept existing ${spec.title} configuration)`);
      return;
    } else {
      if (servers[spec.key]) delete servers[spec.key];
      console.log(`  (skipped ${spec.title})`);
      return;
    }
  }

  if (input1 === "-") {
    if (servers[spec.key]) {
      delete servers[spec.key];
      console.log(`  (disabled ${spec.title})`);
    }
    return;
  }

  const input2 = await askFn(`${spec.envVar2}`, shown2);
  if (!input2) {
    console.log(`  (skipped ${spec.title} - API key required)`);
    return;
  }

  servers[spec.key] = {
    command: spec.command,
    args: spec.args(),
    env: {},
  };
  servers[spec.key].env[spec.envVar] = input1;
  servers[spec.key].env[spec.envVar2] = input2;
  console.log(`  (saved ${spec.title})`);
}

async function promptStandardServer(spec, servers, existingEnv, askFn) {
  const currentVal = existingEnv[spec.envVar] || "";
  const shown = currentVal ? maskKey(currentVal) : "";
  const promptText =
    spec.envVar === "POSTGRES_CONNECTION_STRING"
      ? "PostgreSQL connection string (e.g., postgresql://user:pass@localhost/db)"
      : spec.envVar;
  console.log(
    `\n• ${spec.title} ${spec.envVar ? "API key" : ""} → ${spec.helpUrl}`
  );
  const input = await askFn(promptText, shown);

  if (!input) {
    if (currentVal) {
      // keep as-is
      console.log(`  (kept existing ${spec.title} key)`);
      return;
    } else {
      // not configured → ensure it's absent
      if (servers[spec.key]) delete servers[spec.key];
      console.log(`  (skipped ${spec.title})`);
      return;
    }
  }

  if (input === "-") {
    if (servers[spec.key]) {
      delete servers[spec.key];
      console.log(`  (disabled ${spec.title})`);
    } else {
      console.log(`  (no ${spec.title} entry to disable)`);
    }
    return;
  }

  // Set/update server with provided key
  const entry = {
    command: spec.command,
    args: typeof spec.args === "function" ? spec.args(input) : spec.args,
    env: {},
  };
  entry.env[spec.envVar] = input;
  servers[spec.key] = entry;
  console.log(`  (saved ${spec.title})`);
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

        console.log(`  Installing ${spec.title}...`);
        execSync(command, { stdio: "inherit" });
        console.log(`  ✅ ${spec.title} configured successfully`);
        configuredServers.push(spec.title);
      } else if (serverConfig && serverConfig.action === "disable") {
        // Remove existing server
        try {
          execSync(`claude mcp remove ${spec.key}`, { stdio: "pipe" });
          console.log(`  🗑️  ${spec.title} removed`);
        } catch {
          // Server wasn't configured, that's fine
          console.log(`  ⚠️  ${spec.title} was not configured`);
        }
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
  } catch (error) {
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

  // Agent definitions directory
  const agentsDir = path.join(PROJ_CLAUDE_DIR, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  // Copy all agent definition files from source
  const sourceAgentsDir = path.join(__dirname, "..", ".claude", "agents");
  if (fs.existsSync(sourceAgentsDir)) {
    const agentFiles = fs
      .readdirSync(sourceAgentsDir)
      .filter((f) => f.endsWith(".md"));

    for (const agentFile of agentFiles) {
      const sourcePath = path.join(sourceAgentsDir, agentFile);
      const targetPath = path.join(agentsDir, agentFile);

      if (!fs.existsSync(targetPath)) {
        const agentContent = fs.readFileSync(sourcePath, "utf8");
        fs.writeFileSync(targetPath, agentContent, "utf8");
        console.log(
          `• .claude/agents/${agentFile} created (specialized agent)`
        );
      }
    }
  }

  // Install agents to global Claude directory for Task tool discovery
  const globalAgentsDir = path.join(GLOBAL_DIR, "agents");
  fs.mkdirSync(globalAgentsDir, { recursive: true });

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
    console.log(
      "• Agents are now available in ~/.claude/agents/ and .claude/agents/"
    );
    console.log("• To register agents with Claude Code, run: claude");
    console.log("• Then type: /agents");
    console.log("• Use the interactive menu to enable your custom agents");
    console.log(
      "• After registration, you can use: Task tool with subagent_type: 'planner', 'test-writer', etc."
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

function showPostSetupGuide() {
  const vsCodeInstalled = checkVSCodeExtension();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Setup complete! Here's what to do next:");
  console.log("=".repeat(60));

  console.log("\n🚀 IMMEDIATE NEXT STEPS:");
  console.log("  1. Open VS Code in your project directory");
  console.log("  2. Open terminal (Cmd+` or Ctrl+`)");
  console.log("  3. Run: claude");
  if (!vsCodeInstalled) {
    console.log("  4. Claude extension will auto-install in VS Code");
  } else {
    console.log("  4. ✓ Claude extension already installed");
  }

  console.log("\n🎯 FIRST PROJECT CHECKLIST:");
  console.log("  □ Create a new project: npx claude-code-quickstart init");
  console.log("  □ Open CLAUDE.md to see your coding rules");
  console.log('  □ Try: "Hey Claude, help me build a simple React app"');
  console.log('  □ Test MCP servers: "Search for X" (uses Brave Search)');

  console.log("\n📚 CONFIGURED MCP SERVERS:");
  console.log("  • Check your MCP servers with: claude mcp list");
  console.log("  • Test them with /mcp command in Claude Code");

  console.log("\n💡 PRO TIPS:");
  console.log("  • Use qnew, qplan, qcode shortcuts for faster development");
  console.log("  • Manage MCP servers: claude mcp add/remove/list");
  console.log("  • VS Code shortcuts: Cmd+Esc (Mac) / Ctrl+Esc (Windows)");

  console.log("\n📖 RESOURCES:");
  console.log("  • Troubleshooting → https://docs.anthropic.com/claude-code");
  console.log("  • CLAUDE.md rules → ./CLAUDE.md (or wherever you init)");

  console.log("\nReady to build something amazing! 🎉\n");
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
        } catch (error) {
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
