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
    rl.question(prompt, (a) => res((a || "").trim())),
  );
}

async function askScope() {
  console.log('\n🎯 Choose Claude Code MCP server scope:');
  console.log('  1) User (recommended) - Available across all your projects');
  console.log('  2) Project - Shared with team via .mcp.json file');
  console.log('  3) Local - Private to current session only');
  
  const choice = await ask('Select scope (1-3)', '1');
  
  switch (choice) {
    case '1':
    case 'user':
    case 'u':
      return 'user';
    case '2':
    case 'project':
    case 'p':
      return 'project';
    case '3':
    case 'local':
    case 'l':
      return 'local';
    default:
      console.log('  Using default: User scope');
      return 'user';
  }
}

function maskKey(s) {
  if (!s) return "";
  if (s.length <= 2) return "…";
  if (s.length <= 8) return s[0] + "…" + s.slice(-1);
  return s.slice(0, 5) + "…" + s.slice(-3);
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
  const parts = ['claude', 'mcp', 'add'];
  
  // Add scope if not default
  if (scope && scope !== 'local') {
    parts.push('--scope', scope);
  }
  
  // Add server name BEFORE environment variables
  parts.push(spec.key);
  
  // Add environment variables AFTER server name
  if (envVars && typeof envVars === 'object') {
    for (const [key, value] of Object.entries(envVars)) {
      if (value) {
        parts.push('--env', `${key}=${value}`);
      }
    }
  }
  
  // Add separator
  parts.push('--');
  
  // Add command
  parts.push(spec.command);
  
  // Add args - handle function vs array
  const args = typeof spec.args === 'function' 
    ? spec.args(...extraArgs)
    : spec.args || [];
  
  parts.push(...args);
  
  return parts.join(' ');
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
    key: "github",
    title: "GitHub",
    envVar: "GITHUB_PERSONAL_ACCESS_TOKEN",
    helpUrl: "https://github.com/settings/tokens",
    command: "npx",
    args: () => ["-y", "@modelcontextprotocol/server-github"],
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
    key: "filesystem",
    title: "File System",
    promptType: "path",
    helpUrl: "https://modelcontextprotocol.io/docs/servers/filesystem",
    command: "npx",
    args: (val) => [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      val || process.cwd(),
    ],
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
    currentPath,
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
  const input = await askFn('Directory path for file system access', process.cwd());
  
  if (input === '-') {
    return { action: 'disable' };
  }
  
  if (!input) {
    return { action: 'skip' };
  }
  
  return {
    action: 'configure',
    extraArgs: [input || process.cwd()]
  };
}

async function promptWranglerServerForCommand(spec, askFn) {
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  console.log('  ⚠️  Requires: npx wrangler login (run separately before using)');
  const input = await askFn('Enable Cloudflare MCP server? (y/N)', 'n');
  
  if (input === '-') {
    return { action: 'disable' };
  }
  
  if (input.toLowerCase() !== 'y') {
    return { action: 'skip' };
  }
  
  return {
    action: 'configure',
    envVars: {}
  };
}

async function promptDualEnvServerForCommand(spec, askFn) {
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  const input1 = await askFn(`${spec.envVar} (e.g., http://localhost:5678/api/v1)`, '');
  
  if (input1 === '-') {
    return { action: 'disable' };
  }
  
  if (!input1) {
    return { action: 'skip' };
  }
  
  const input2 = await askFn(`${spec.envVar2}`, '');
  if (!input2) {
    console.log(`  (skipped ${spec.title} - API key required)`);
    return { action: 'skip' };
  }
  
  return {
    action: 'configure',
    envVars: {
      [spec.envVar]: input1,
      [spec.envVar2]: input2
    }
  };
}

async function promptStandardServerForCommand(spec, askFn) {
  const promptText = spec.envVar === 'POSTGRES_CONNECTION_STRING' 
    ? 'PostgreSQL connection string (e.g., postgresql://user:pass@localhost/db)'
    : spec.envVar;
  
  console.log(`\n• ${spec.title} ${spec.envVar ? 'API key' : ''} → ${spec.helpUrl}`);
  const input = await askFn(promptText, '');
  
  if (input === '-') {
    return { action: 'disable' };
  }
  
  if (!input) {
    return { action: 'skip' };
  }
  
  return {
    action: 'configure',
    envVars: {
      [spec.envVar]: input
    }
  };
}

async function promptWranglerServer(spec, servers, askFn) {
  console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
  console.log(
    "  ⚠️  Requires: npx wrangler login (run separately before using)",
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
    `  (enabled ${spec.title} - remember to run: npx wrangler login)`,
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
    shown1,
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
    `\n• ${spec.title} ${spec.envVar ? "API key" : ""} → ${spec.helpUrl}`,
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
  
  console.log('\n📁 Configuring Claude Code MCP servers');
  
  // Get scope preference
  const scope = await askScope();
  console.log(`\nUsing ${scope} scope for MCP server configuration\n`);
  
  console.log(
    '🔌 Configure MCP servers (Enter = skip; "-" = disable existing)',
  );

  // Track configured servers for summary
  const configuredServers = [];
  const skippedServers = [];
  const failedServers = [];

  for (const spec of SERVER_SPECS) {
    // Route to appropriate prompt handler and collect results
    let serverConfig = null;
    
    try {
      if (spec.promptType === "path") {
        serverConfig = await promptPathServerForCommand(spec, ask);
      } else if (spec.promptType === "wrangler") {
        serverConfig = await promptWranglerServerForCommand(spec, ask);
      } else if (spec.envVar2) {
        serverConfig = await promptDualEnvServerForCommand(spec, ask);
      } else {
        serverConfig = await promptStandardServerForCommand(spec, ask);
      }
      
      if (serverConfig && serverConfig.action === 'configure') {
        // Build and execute claude mcp add command
        const command = buildClaudeMcpCommand(
          spec, 
          scope, 
          serverConfig.envVars, 
          serverConfig.extraArgs || []
        );
        
        console.log(`  Installing ${spec.title}...`);
        execSync(command, { stdio: 'inherit' });
        console.log(`  ✅ ${spec.title} configured successfully`);
        configuredServers.push(spec.title);
        
      } else if (serverConfig && serverConfig.action === 'disable') {
        // Remove existing server
        try {
          execSync(`claude mcp remove ${spec.key}`, { stdio: 'pipe' });
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
  console.log('\n' + '='.repeat(50));
  console.log('📊 Configuration Summary:');
  if (configuredServers.length > 0) {
    console.log(`  ✅ Configured: ${configuredServers.join(', ')}`);
  }
  if (skippedServers.length > 0) {
    console.log(`  ⏭️  Skipped: ${skippedServers.join(', ')}`);
  }
  if (failedServers.length > 0) {
    console.log(`  ❌ Failed: ${failedServers.join(', ')}`);
  }
  console.log('='.repeat(50));
  
  // Verify installation
  try {
    console.log('\n🔍 Verifying MCP server installation...');
    execSync('claude mcp list', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Could not verify installation. Run `claude mcp list` to check manually.');
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
      "utf8",
    );
    console.log("• .claude/settings.local.json created (local-only overrides)");
  } else {
    console.log("• .claude/settings.local.json exists (left unchanged)");
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
        "utf8",
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

async function main() {
  const cmd = process.argv[2];

  if (cmd === "init") {
    await configureClaudeCode();
    scaffoldProjectFiles();
    rl.close();
    showPostSetupGuide();
    return;
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
