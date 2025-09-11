#!/usr/bin/env node
const readline = require("node:readline");
const { stdin, stdout } = require("node:process");
const { spawnSync } = require("node:child_process");

const isTTY = !!stdin.isTTY && !!stdout.isTTY;

if (!isTTY) {
  console.log(
    [
      "⚙️  claude-code-quickstart installed.",
      "• This environment is non-interactive. To run guided setup later:",
      "    npx claude-code-quickstart",
      "• Or initialize a repo:",
      "    npx claude-code-quickstart init",
    ].join("\n")
  );
  process.exit(0);
}

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

(async () => {
  console.log("🚀 Sparkry.AI — Claude Code Quickstart");
  console.log(
    "This will configure global settings (~/.claude/settings.json) and can scaffold project files."
  );
  const go = (await ask("Run guided setup now? (Y/n) ")) || "y";
  if (go.toLowerCase().startsWith("n")) {
    rl.close();
    console.log("\nRun later: npx claude-code-quickstart");
    process.exit(0);
  }
  rl.close();
  const r = spawnSync(process.execPath, [require.resolve("./cli.js")], {
    stdio: "inherit",
  });
  process.exit(r.status || 0);
})();
