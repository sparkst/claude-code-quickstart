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
const GLOBAL_SETTINGS = path.join(GLOBAL_DIR, "settings.json");

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

function loadJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    console.warn(
      `! Warning: could not parse ${p}. Backing up to ${p}.bak and starting fresh.`,
    );
    try {
      fs.copyFileSync(p, `${p}.bak`);
    } catch {}
    return fallback;
  }
}
function writeJsonPretty(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function ensureDefaultMode(obj) {
  if (!obj.defaultMode) obj.defaultMode = "plan";
  return obj;
}

// Merge safe, keep user’s existing rules, add our defaults if missing
function mergePermissions(base) {
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

async function promptMcpServers(existingGlobal) {
  const merged = ensureServersPreserved(existingGlobal);
  const servers = merged.mcpServers;

  console.log(
    '\n🔌 Configure MCP servers (Enter = keep existing; "-" = disable; empty new on missing = skip)',
  );

  for (const spec of SERVER_SPECS) {
    const existingEntry = servers[spec.key] || {};
    const existingEnv =
      existingEntry.env && typeof existingEntry.env === "object"
        ? existingEntry.env
        : {};

    // Route to appropriate prompt handler
    if (spec.promptType === "path") {
      await promptPathServer(spec, servers, ask);
    } else if (spec.promptType === "wrangler") {
      await promptWranglerServer(spec, servers, ask);
    } else if (spec.envVar2) {
      await promptDualEnvServer(spec, servers, existingEnv, ask);
    } else {
      await promptStandardServer(spec, servers, existingEnv, ask);
    }
  }

  return merged.mcpServers;
}

async function configureGlobal() {
  console.log("\n📁 Updating global settings: ~/.claude/settings.json");
  const current = loadJsonSafe(GLOBAL_SETTINGS, {});
  let merged = ensureDefaultMode(mergePermissions(current));
  merged.additionalDirectories = merged.additionalDirectories || [];
  // Merge servers but preserve others we don't manage
  const before = ensureServersPreserved(merged);
  const updatedServers = await promptMcpServers(before);
  merged.mcpServers = updatedServers;
  writeJsonPretty(GLOBAL_SETTINGS, merged);
  console.log("✅ Wrote global settings.");
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
  const configuredServers = [];
  try {
    const settings = loadJsonSafe(GLOBAL_SETTINGS, {});
    if (settings.mcpServers) {
      for (const key of Object.keys(settings.mcpServers)) {
        const serverSpec = SERVER_SPECS.find((s) => s.key === key);
        if (serverSpec) {
          configuredServers.push(
            serverSpec.title.replace(" (Recommended)", ""),
          );
        }
      }
    }
  } catch {}

  if (configuredServers.length > 0) {
    console.log("  ✓ " + configuredServers.join(", "));
  } else {
    console.log("  (None configured - run setup again to add)");
  }

  console.log("\n💡 PRO TIPS:");
  console.log("  • Use qnew, qplan, qcode shortcuts for faster development");
  console.log("  • Check ~/.claude/settings.json for your configuration");
  console.log("  • VS Code shortcuts: Cmd+Esc (Mac) / Ctrl+Esc (Windows)");

  console.log("\n📖 RESOURCES:");
  console.log("  • Troubleshooting → https://docs.anthropic.com/claude-code");
  console.log("  • CLAUDE.md rules → ./CLAUDE.md (or wherever you init)");

  console.log("\nReady to build something amazing! 🎉\n");
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === "init") {
    await configureGlobal();
    scaffoldProjectFiles();
    rl.close();
    showPostSetupGuide();
    return;
  }

  console.log("Sparkry.AI — Claude Code Quickstart");
  console.log("1) Configure global settings (~/.claude/settings.json)");
  await configureGlobal();

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
