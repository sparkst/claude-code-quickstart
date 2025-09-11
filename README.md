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
npm test              # Run all tests (156 tests: 74 passing + 82 meaningful TDD failures)
npm run lint          # ESLint checks (0 warnings)
npm run format        # Prettier formatting
```

#### Testing Infrastructure
The project follows strict TDD methodology with a multi-layered testing architecture:

- **Unit Tests** — Individual function testing with parameterized constants
- **Integration Tests** — Real environment MCP server integration  
- **E2E Tests** — Full CLI workflow validation
- **Performance Tests** — <500ms CLI responsiveness validation
- **macOS Error Boundary Tests** — Platform-specific error handling

Test utilities are designed to support TDD flow with meaningful failures that guide implementation:
```bash
# Test constants (parameterized to avoid hardcoded literals)
test/utils/test-constants.js

# Test execution and debugging
npm test -- --verbose           # Detailed test output
npm test -- --watch             # Watch mode for TDD
npm test -- test/unit/          # Run specific test category
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
├── test/                       # TDD-compliant test infrastructure
│   ├── utils/                 # Test utilities with parameterized constants
│   │   ├── test-constants.js  # Parameterized values (no hardcoded literals)
│   │   ├── test-helpers.js    # Basic test utilities
│   │   ├── performance-helpers.js # Performance measurement utilities
│   │   ├── error-simulation-helpers.js # Error testing utilities
│   │   ├── real-environment-helpers.js # Environment testing
│   │   └── e2e-helpers.js     # End-to-end test utilities
│   ├── integration/           # Real environment testing
│   ├── e2e/                  # End-to-end workflow tests
│   ├── performance/          # <500ms responsiveness tests
│   └── error-boundaries/     # macOS-specific error handling tests
├── templates/                 # Project scaffolding templates
│   ├── CLAUDE.md             # TDD methodology template
│   ├── README.md             # Progressive docs template
│   └── *.json                # Configuration templates
├── requirements/              # Requirements with REQ IDs
│   ├── current.md            # Active requirements
│   └── requirements.lock.md  # Snapshot for current task
├── .claude/
│   ├── agents/               # Agent definitions
│   └── settings.json         # Claude Code configuration
└── CHANGELOG.md              # Version history and changes
```