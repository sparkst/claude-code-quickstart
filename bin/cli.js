#!/usr/bin/env node
/**
 * Sparkry.AI — Claude Code Quickstart CLI
 * - Configures ~/.claude/settings.json (plan mode, permissions, MCP servers)
 * - Optionally scaffolds project files in CWD (CLAUDE.md, .claude/)
 * - Preserves existing MCP servers and keys
 * - Simple prompts with API key links + masked re-entry
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');

const HOME = os.homedir();
const GLOBAL_DIR = path.join(HOME, '.claude');
const GLOBAL_SETTINGS = path.join(GLOBAL_DIR, 'settings.json');

const PROJECT_DIR = process.cwd();
const PROJ_CLAUDE_DIR = path.join(PROJECT_DIR, '.claude');

const TEMPLATES = path.join(__dirname, '..', 'templates');
const TEMPLATE = (f) => fs.readFileSync(path.join(TEMPLATES, f), 'utf8');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q, def = '') {
  const prompt = def ? `${q} [${def}] ` : `${q} `;
  return new Promise((res) => rl.question(prompt, (a) => res((a || '').trim())));
}

function loadJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    console.warn(`! Warning: could not parse ${p}. Backing up to ${p}.bak and starting fresh.`);
    try { fs.copyFileSync(p, `${p}.bak`); } catch {}
    return fallback;
  }
}
function writeJsonPretty(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ensureDefaultMode(obj) {
  if (!obj.defaultMode) obj.defaultMode = 'plan';
  return obj;
}

// Merge safe, keep user’s existing rules, add our defaults if missing
function mergePermissions(base) {
  const deny = new Set([
    'Read(*.env)','Read(**/*.pem)','Read(**/*.key)','Read(**/secrets/**)','Read(**/credentials/**)','Read(~/.*ssh/**)',
    'Edit(*.env)','Edit(**/*.pem)','Edit(**/*.key)','Edit(**/secrets/**)','Edit(**/credentials/**)'
  ]);
  const ask = new Set(['Bash(*)','Edit(/**)']);
  const allow = new Set([
    'Read(/**)','Bash(npm run test*)','Bash(yarn test*)','Bash(pnpm test*)',
    'Bash(npx vitest*)','Bash(npx jest*)','Bash(npm run lint*)','Bash(npm run typecheck)','Bash(npm run prettier:check)'
  ]);

  const out = base || {};
  out.permissions = out.permissions || {};
  for (const [k, set] of [['deny', deny], ['ask', ask], ['allow', allow]]) {
    const existing = new Set(out.permissions[k] || []);
    for (const item of set) existing.add(item);
    out.permissions[k] = Array.from(existing);
  }
  return out;
}

function maskKey(s) {
  if (!s) return '';
  if (s.length <= 2) return '…';
  if (s.length <= 8) return s[0] + '…' + s.slice(-1);
  return s.slice(0, 5) + '…' + s.slice(-3);
}

function ensureServersPreserved(existing) {
  const out = existing && typeof existing === 'object' ? { ...existing } : {};
  out.mcpServers = out.mcpServers && typeof out.mcpServers === 'object' ? { ...out.mcpServers } : {};
  return out;
}

const SERVER_SPECS = [
  {
    key: 'context7',
    title: 'Context7',
    envVar: 'CONTEXT7_API_KEY',
    helpUrl: 'https://context7.com/dashboard',
    // correct package name per upstream
    command: 'npx',
    args: (val) => ['-y', '@upstash/context7-mcp', '--api-key', val]
  },
  {
    key: 'brave-search',
    title: 'Brave Search',
    envVar: 'BRAVE_API_KEY',
    helpUrl: 'https://brave.com/search/api/',
    command: 'npx',
    args: () => ['-y', '@brave/brave-search-mcp-server']
  },
  {
    key: 'supabase',
    title: 'Supabase',
    envVar: 'SUPABASE_ACCESS_TOKEN',
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    command: 'npx',
    args: (val) => ['-y', '@supabase/mcp-server-supabase', `--access-token=${val}`]
  },
  {
    key: 'tavily',
    title: 'Tavily',
    envVar: 'TAVILY_API_KEY',
    helpUrl: 'https://docs.tavily.com/documentation/api-reference/authentication',
    command: 'npx',
    args: () => ['-y', '@tavily/mcp']
  },
  {
    key: 'github',
    title: 'GitHub',
    envVar: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    helpUrl: 'https://github.com/settings/tokens',
    command: 'npx',
    args: () => ['-y', '@modelcontextprotocol/server-github']
  }
];

async function promptMcpServers(existingGlobal) {
  const merged = ensureServersPreserved(existingGlobal);
  const servers = merged.mcpServers;

  console.log('\n🔌 Configure MCP servers (Enter = keep existing; "-" = disable; empty new on missing = skip)');
  for (const spec of SERVER_SPECS) {
    const existingEntry = servers[spec.key] || {};
    const existingEnv = existingEntry.env && typeof existingEntry.env === 'object' ? existingEntry.env : {};
    const currentVal = existingEnv[spec.envVar] || '';
    const shown = currentVal ? maskKey(currentVal) : '';
    console.log(`\n• ${spec.title} API key → ${spec.helpUrl}`);
    const input = await ask(`${spec.envVar}`, shown);

    if (!input) {
      if (currentVal) {
        // keep as-is
        console.log(`  (kept existing ${spec.title} key)`);
        continue;
      } else {
        // not configured → ensure it’s absent
        if (servers[spec.key]) delete servers[spec.key];
        console.log(`  (skipped ${spec.title})`);
        continue;
      }
    }

    if (input === '-') {
      if (servers[spec.key]) {
        delete servers[spec.key];
        console.log(`  (disabled ${spec.title})`);
      } else {
        console.log(`  (no ${spec.title} entry to disable)`);
      }
      continue;
    }

    // Set/update server with provided key
    const entry = {
      command: spec.command,
      args: typeof spec.args === 'function' ? spec.args(input) : spec.args,
      env: {}
    };
    entry.env[spec.envVar] = input;
    servers[spec.key] = entry;
    console.log(`  (saved ${spec.title})`);
  }
  return merged.mcpServers;
}

async function configureGlobal() {
  console.log('\n📁 Updating global settings: ~/.claude/settings.json');
  const current = loadJsonSafe(GLOBAL_SETTINGS, {});
  let merged = ensureDefaultMode(mergePermissions(current));
  merged.additionalDirectories = merged.additionalDirectories || [];
  // Merge servers but preserve others we don't manage
  const before = ensureServersPreserved(merged);
  const updatedServers = await promptMcpServers(before);
  merged.mcpServers = updatedServers;
  writeJsonPretty(GLOBAL_SETTINGS, merged);
  console.log('✅ Wrote global settings.');
}

function scaffoldProjectFiles() {
  console.log('\n🧩 Scaffolding project files in:', PROJECT_DIR);

  // CLAUDE.md
  const claudeMd = path.join(PROJECT_DIR, 'CLAUDE.md');
  if (!fs.existsSync(claudeMd)) {
    fs.writeFileSync(claudeMd, TEMPLATE('CLAUDE.md'), 'utf8');
    console.log('• CLAUDE.md created');
  } else {
    console.log('• CLAUDE.md exists (left unchanged)');
  }

  // .claude/settings.json
  fs.mkdirSync(PROJ_CLAUDE_DIR, { recursive: true });
  const projSettings = path.join(PROJ_CLAUDE_DIR, 'settings.json');
  if (!fs.existsSync(projSettings)) {
    fs.writeFileSync(projSettings, TEMPLATE('project-settings.json'), 'utf8');
    console.log('• .claude/settings.json created (safe defaults, no secrets)');
  } else {
    console.log('• .claude/settings.json exists (left unchanged)');
  }

  // .claude/settings.local.json (empty valid JSON)
  const projLocal = path.join(PROJ_CLAUDE_DIR, 'settings.local.json');
  if (!fs.existsSync(projLocal)) {
    fs.writeFileSync(projLocal, TEMPLATE('project-settings.local.json'), 'utf8');
    console.log('• .claude/settings.local.json created (local-only overrides)');
  } else {
    console.log('• .claude/settings.local.json exists (left unchanged)');
  }

  // .gitignore (append secret guardrails if missing)
  const gi = path.join(PROJECT_DIR, '.gitignore');
  const guard = [
    '',
    '# Claude Code secret guardrails',
    '.env',
    '.env.*',
    '*.pem',
    '*.key',
    '**/secrets/**',
    '**/credentials/**',
    '**/.aws/**',
    '**/.ssh/**'
  ].join('\n');

  try {
    let cur = '';
    if (fs.existsSync(gi)) cur = fs.readFileSync(gi, 'utf8');
    if (!cur.includes('# Claude Code secret guardrails')) {
      fs.writeFileSync(gi, (cur ? cur.trimEnd() + '\n' : '') + guard + '\n', 'utf8');
      console.log('• .gitignore updated with secret guardrails');
    } else {
      console.log('• .gitignore already includes secret guardrails');
    }
  } catch {
    console.warn('! Skipped .gitignore update (permission or fs issue)');
  }

  console.log('✅ Project scaffold complete.');
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'init') {
    await configureGlobal();
    scaffoldProjectFiles();
    rl.close();
    console.log('\nNext: open VS Code → terminal → run: claude   (login on first run)');
    return;
  }

  console.log('Sparkry.AI — Claude Code Quickstart');
  console.log('1) Configure global settings (~/.claude/settings.json)');
  await configureGlobal();

  const doProj = (await ask('\nAlso scaffold project files in current dir? (Y/n) ', 'y')).toLowerCase();
  if (!doProj.startsWith('n')) scaffoldProjectFiles();

  rl.close();
  console.log('\nDone. Open VS Code → terminal → run: claude');
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});

