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
- Scaffold project structure with TDD methodology and REQ-ID tracking including complete CLAUDE.md with all QShortcuts
- Create agent definitions for specialized workflows including research-focused qidea workflow
- Apply security enhancements preventing command injection and enforcing trusted domains
- Provide enhanced post-setup experience with specific component listings and practical usage examples
- Deploy synchronized templates ensuring new installations get latest CLAUDE.md with comprehensive MCP server integration guidelines

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
The project follows strict TDD methodology with a multi-layered testing architecture designed for production-grade reliability:

- **Unit Tests** — Individual function testing with parameterized constants and zero hardcoded literals
- **Security Tests** — Comprehensive validation preventing command injection, path traversal, and buffer overflow (70+ tests)
- **Integration Tests** — Real environment MCP server integration with actual subprocess execution
- **E2E Tests** — Full CLI workflow validation using real process execution (no simulation)
- **Performance Tests** — <500ms CLI responsiveness validation with proper benchmarking
- **macOS Error Boundary Tests** — Platform-specific error handling for permissions and Gatekeeper

**TypeScript Test Architecture (v1.0.9):**
```bash
# Modular TypeScript test utilities (REQ-500-503)
test/utils/cli-executor.ts         # Real CLI subprocess execution
test/utils/test-environment.ts     # Environment management and cleanup
test/utils/workflow-validator.ts   # Workflow validation and monitoring
test/utils/e2e-types.ts           # Comprehensive TypeScript interfaces
test/utils/security-validator.ts   # Security validation and injection prevention

# Test execution and debugging
npm test -- --verbose           # Detailed test output with real process execution
npm test -- --watch             # Watch mode for TDD with TypeScript compilation
npm test -- test/unit/          # Run specific test category
npm test -- test/security/      # Run security validation tests
npm test -- test/utils/         # Run infrastructure tests
```

**Key Testing Improvements:**
- **Real Execution** — All tests use actual subprocess execution via `child_process.spawn` (no simulation)
- **TypeScript Migration** — Modular architecture replacing 1000+ line JavaScript monolith
- **Security Focus** — Command injection prevention, domain validation, and input sanitization
- **Resource Management** — Proper cleanup and error handling preventing test pollution
- **TDD Compliance** — Meaningful failures that guide implementation with REQ-ID traceability

## Architecture Overview

This CLI tool follows a template-driven architecture with MCP server integration and security-first design. The system consists of:

1. **Smart MCP Server Configuration** — Production-ready servers with intelligent status detection for all server types (including SSE), eliminating false failure messages during setup
2. **Advanced Security Validation** — HTTPS enforcement, trusted domain allowlists, command injection prevention, shell metacharacter filtering
3. **Enhanced User Experience** — Comprehensive post-setup guidance with specific component listings and practical usage examples
4. **Project Scaffolding** — Synchronized templates following Progressive Documentation Guide with TDD methodology, comprehensive MCP server integration guidelines, and all QShortcuts including qidea research workflow
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
├── test/                       # Production-grade TDD test infrastructure (v1.0.9)
│   ├── utils/                 # TypeScript test utilities with real execution
│   │   ├── test-constants.js  # Parameterized values (no hardcoded literals)
│   │   ├── cli-executor.ts    # Real CLI subprocess execution (REQ-503)
│   │   ├── cli-executor.js    # JavaScript compatibility layer
│   │   ├── test-environment.ts # Environment management and cleanup (REQ-500)
│   │   ├── test-environment.js # JavaScript compatibility layer
│   │   ├── workflow-validator.spec.ts # Workflow validation testing
│   │   ├── e2e-types.ts       # Comprehensive TypeScript interfaces (REQ-500)
│   │   ├── security-validation-missing.spec.ts # Security validation tests (REQ-502)
│   │   ├── real-process-execution.spec.ts # Real execution testing (REQ-503)
│   │   ├── cli-mcp-integration.spec.ts # CLI MCP integration tests (REQ-501)
│   │   ├── cli-executor-factory.spec.ts # Factory pattern testing
│   │   ├── test-environment.spec.ts # Environment testing
│   │   ├── github-actions-helpers.js # CI/CD workflow testing utilities
│   │   ├── performance-helpers.js # Performance measurement utilities
│   │   ├── error-simulation-helpers.js # Error testing utilities
│   │   └── real-environment-helpers.js # Environment testing
│   ├── ci-cd/                 # CI/CD pipeline tests
│   │   └── github-actions.spec.js # Comprehensive workflow validation
│   ├── integration/           # Real environment testing with subprocess execution
│   ├── e2e/                  # End-to-end workflow tests (real CLI execution)
│   ├── performance/          # <500ms responsiveness tests
│   ├── security/             # Comprehensive security validation (70+ tests)
│   └── error-boundaries/     # macOS-specific error handling tests
├── templates/                 # Project scaffolding templates (synchronized with root)
│   ├── CLAUDE.md             # TDD methodology template with all QShortcuts and MCP guidance
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