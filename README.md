# Claude Code Quickstart

## Mental Model
One-command CLI tool that sets up Claude Code with MCP servers, project scaffolding, and TDD methodology. Bridges the gap between Claude Code and real development workflows with pre-configured integrations, safety permissions, and agent-based architecture.

## Key Entry Points
- `bin/cli.js` — Main CLI implementation and MCP server configuration
- `security/` — Security validation, threat prevention, and URL sanitization
- `templates/` — Project scaffolding templates (CLAUDE.md, README.md, settings)
- `requirements/` — TDD requirements documentation with REQ IDs
- `.claude/agents/` — Agent definitions for specialized workflows
- `.github/` — CI/CD pipeline with quality gates, security scanning, and deployment automation

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
- Set up MCP servers with smart server detection (Tavily, Brave Search, Context7, Supabase, GitHub, n8n, Cloudflare SSE with production-ready bindings and builds)
- Configure Claude Code settings with safe permissions and advanced security validation
- Scaffold project structure with TDD methodology and REQ-ID tracking
- Create agent definitions for specialized workflows including research-focused qidea workflow
- Apply security enhancements preventing command injection and enforcing trusted domains
- Provide enhanced post-setup experience with specific component listings and practical usage examples

### Development Setup (Contributors)
```bash
git clone <repository>
cd claude-code-quickstart
npm install
npm test              # Run all tests (296 tests: 214 passing + 82 meaningful TDD failures)
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

This CLI tool follows a template-driven architecture with MCP server integration and security-first design. The system consists of:

1. **Smart MCP Server Configuration** — Production-ready servers with intelligent status detection, avoiding false failure messages during setup
2. **Advanced Security Validation** — HTTPS enforcement, trusted domain allowlists, command injection prevention, shell metacharacter filtering
3. **Enhanced User Experience** — Comprehensive post-setup guidance with specific component listings and practical usage examples
4. **Project Scaffolding** — Templates following Progressive Documentation Guide with TDD methodology and comprehensive MCP server integration guidelines
5. **Agent System** — Specialized agents for TDD, planning, documentation, security review, release management, and zero-code research workflows
6. **Requirements Management** — REQ-ID based tracking for TDD compliance with requirements.lock pattern

For detailed implementation guidelines, see [CLAUDE.md](./CLAUDE.md).

## Project Structure

```
├── bin/
│   ├── cli.js                  # Main CLI implementation with security validation
│   ├── cli-mcp.spec.js        # MCP server tests (70 security tests)
│   └── cli.integration.spec.js # Integration tests
├── .github/                    # CI/CD Pipeline Infrastructure
│   ├── workflows/             # GitHub Actions workflows
│   │   ├── ci.yml            # Main CI pipeline with quality gates
│   │   ├── security.yml      # Security scanning and compliance
│   │   ├── dashboard.yml     # Pipeline health monitoring
│   │   ├── deploy.yml        # Production deployment
│   │   ├── pr-validation.yml # Pull request validation
│   │   └── release.yml       # Release management
│   ├── README.md             # CI/CD domain documentation
│   └── .claude-context       # CI/CD domain context
├── .githooks/                  # Git hooks for local validation
│   ├── pre-commit            # Format, lint, test, secret scan
│   └── pre-push              # Full validation suite
├── test/                       # TDD-compliant test infrastructure
│   ├── utils/                 # Test utilities with parameterized constants
│   │   ├── test-constants.js  # Parameterized values (no hardcoded literals)
│   │   ├── test-helpers.js    # Basic test utilities
│   │   ├── github-actions-helpers.js # CI/CD workflow testing utilities
│   │   ├── performance-helpers.js # Performance measurement utilities
│   │   ├── error-simulation-helpers.js # Error testing utilities
│   │   ├── real-environment-helpers.js # Environment testing
│   │   └── e2e-helpers.js     # End-to-end test utilities
│   ├── ci-cd/                 # CI/CD pipeline tests
│   │   └── github-actions.spec.js # Comprehensive workflow validation
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
├── security/                  # Security domain documentation
│   ├── README.md             # Security patterns and threat model
│   └── .claude-context       # Security domain context
├── .claude/
│   ├── agents/               # Agent definitions
│   └── settings.json         # Claude Code configuration
└── CHANGELOG.md              # Version history and changes
```