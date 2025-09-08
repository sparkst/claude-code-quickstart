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
# Update templates to latest versions (safe with backups):
npx claude-code-quickstart update-templates
```

## Commands

### `init` (default)
Sets up Claude Code MCP servers and scaffolds project files (CLAUDE.md, README.md, .claude/ templates).

### `update-templates`
Updates existing templates to their latest versions with interactive selection:
- ✅ **Safe**: Creates automatic backups before changes
- 🎯 **Selective**: Choose which templates to update
- 🔍 **Smart detection**: Identifies identical, outdated, missing, and customized files
- 🧪 **Dry run**: Preview changes before applying
- ↩️ **Rollback**: Easy restoration from backups

Detects template states:
- **Identical** ✅ - No changes needed
- **Outdated** ⚠️ - Can be safely updated  
- **Customized** 🔧 - Manual review recommended
- **Missing** ❌ - Will be created

### `help`
Shows usage information and available commands.

