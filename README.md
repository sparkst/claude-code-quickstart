# claude-code-quickstart · Sparkry.AI

Local-first setup for **Claude Code + VS Code** (Sabrina-style):
- Ask/Plan before changing anything
- **TDD** (fail test → implement)
- Small, reviewable diffs
- **Security-forward** permissions (deny secrets, ask to edit/run)

## Quick start

```bash
npm i -g claude-code-quickstart          # interactive postinstall if TTY
# Or run later:
npx claude-code-quickstart               # guided setup (user scope)
# Optional Mac bootstrap (Node/VS Code/Claude CLI):
"$(npm root -g)"/claude-code-quickstart/scripts/setup-claude-mac.sh
# Initialize the current repo (CLAUDE.md + .claude/ files):
npx claude-code-quickstart init

