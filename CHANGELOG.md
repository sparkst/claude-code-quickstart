# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-01-11

### Fixed
- **MCP Server Configuration Issues (REQ-001)**
  - Fixed Tavily MCP server package name from `@tavily/mcp` to `tavily-mcp`
  - Added missing `--transport stdio` argument to Brave Search MCP server
  - Verified n8n MCP server dual environment variable configuration
  - All three servers now connect successfully during quickstart setup

### Changed
- **Code Quality Improvements (REQ-002)**
  - Removed 3 unused catch variables in cli.js (cleaner error handling)
  - Removed 4 deprecated function definitions (promptPathServer, promptWranglerServer, promptDualEnvServer, promptStandardServer)
  - Fixed unused variables in test files
  - Resolved all 11 ESLint warnings (now 0 warnings)

### Added
- **Test Infrastructure (REQ-003)**
  - Created `.claude/agents/` directory with placeholder agent files
  - Added REQ-001 test coverage for Tavily and Brave Search server configurations
  - Added proper REQ IDs to test descriptions following TDD methodology
  - Requirements documentation in `requirements/` directory with REQ tracking

### Technical
- All tests now pass: 74/74 ✅
- Zero linting warnings ✅
- Proper TDD compliance with requirements.lock pattern ✅

## [1.0.1] - 2025-01-08

### Fixed
- Resolved agent discovery issues and improved code quality

## [1.0.0] - 2025-01-07

### Added
- Initial release with agent registration system
- Global installation support for Claude Code agents
- MCP server configuration tooling
- Project scaffolding templates