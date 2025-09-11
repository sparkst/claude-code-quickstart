# Current Requirements

## REQ-001: Fix MCP Server Configuration Issues

**Acceptance Criteria:**
- Tavily MCP server uses correct package name `tavily-mcp` instead of non-existent `@tavily/mcp`
- Brave Search MCP server includes `--transport stdio` argument for proper Claude Code compatibility
- n8n MCP server maintains correct dual environment variable configuration (`N8N_API_URL` and `N8N_API_KEY`)
- All three servers successfully connect when users run the quickstart tool

**Non-Goals:**
- Fixing other MCP servers not mentioned (Context7, Supabase, etc. are already working)
- Changing the overall MCP server configuration architecture

**Notes:**
- Root cause: Package names and transport arguments were incorrect in SERVER_SPECS array
- Issue discovered through debugging session where MCP servers failed to connect
- Fix required updating `bin/cli.js` lines 159 and 180

## REQ-002: Code Quality and Linting Compliance

**Acceptance Criteria:**
- All ESLint warnings resolved (currently 11 warnings about unused variables)
- Remove unused catch variables in cli.js (lines 138, 571, 1172)
- Remove unused function definitions that have newer "ForCommand" variants
- Clean up unused variables in test files
- Maintain existing functionality while improving code quality

**Non-Goals:**
- Changing code style or adding new linting rules
- Refactoring working code beyond removing unused variables

**Notes:**
- Part of technical debt cleanup identified during PE code review
- Follows CLAUDE.md principle G-1 (MUST pass lint and typecheck)

## REQ-003: Test Infrastructure Reliability

**Acceptance Criteria:**
- All tests pass (currently 2 integration tests fail due to missing `.claude/agents` directory)
- Create `.claude/agents` directory with placeholder agent files for tests
- Integration tests handle missing directories gracefully
- Test suite runs without errors in CI/CD environment

**Non-Goals:**
- Adding new test cases beyond fixing existing failures
- Changing test framework or testing patterns

**Notes:**
- Test failures prevent reliable CI/CD pipeline
- Tests expect agent files to exist but directory was missing from repository