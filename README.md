# Claude Code Quickstart

## Mental Model
One-command CLI tool that sets up Claude Code with MCP servers, project scaffolding, and TDD methodology. Bridges the gap between Claude Code and real development workflows with pre-configured integrations, safety permissions, and agent-based architecture.

## Key Entry Points
- `bin/cli.js` — Main CLI implementation and MCP server configuration
- `templates/` — Project scaffolding templates (CLAUDE.md, README.md, settings)
- `requirements/` — TDD requirements documentation with REQ IDs
- `.claude/agents/` — Agent definitions for specialized workflows

## Getting Started

### Install Globally
```bash
npm install -g claude-code-quickstart
```

### Run Setup
```bash
claude-code-quickstart
```

This will:
- Set up MCP servers (Tavily, Brave Search, Context7, Supabase, GitHub, n8n)
- Configure Claude Code settings with safe permissions
- Scaffold project structure with TDD methodology
- Create agent definitions for specialized workflows

### Development Setup (Contributors)
```bash
git clone <repository>
cd claude-code-quickstart
npm install
npm test              # Run all tests (74 tests)
npm run lint          # ESLint checks (0 warnings)
npm run format        # Prettier formatting
```

## Architecture Overview

This CLI tool follows a template-driven architecture with MCP server integration. The system consists of:

1. **MCP Server Configuration** — Pre-configured servers for AI workflows
2. **Project Scaffolding** — Templates following Progressive Documentation Guide
3. **Agent System** — Specialized agents for TDD, planning, documentation, etc.
4. **Requirements Management** — REQ-ID based tracking for TDD compliance

For detailed implementation guidelines, see [CLAUDE.md](./CLAUDE.md).

## Project Structure

```
├── bin/
│   ├── cli.js                  # Main CLI implementation
│   ├── cli-mcp.spec.js        # MCP server tests
│   └── cli.integration.spec.js # Integration tests
├── templates/                  # Project scaffolding templates
│   ├── CLAUDE.md              # TDD methodology template
│   ├── README.md              # Progressive docs template
│   └── *.json                 # Configuration templates
├── requirements/               # Requirements with REQ IDs
│   ├── current.md             # Active requirements
│   └── requirements.lock.md   # Snapshot for current task
├── .claude/
│   ├── agents/                # Agent definitions
│   └── settings.json          # Claude Code configuration
└── CHANGELOG.md               # Version history and changes
```