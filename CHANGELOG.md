# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2025-09-11

### Added
- **Comprehensive CI/CD Pipeline (REQ-109, REQ-110, REQ-111, REQ-112)**
  - Complete GitHub Actions workflow system with 6 specialized pipelines
  - Multi-Node.js matrix testing (18.x, 20.x, 22.x) on macOS-latest with fail-safe disabled
  - Progressive quality gates architecture: ci → security-compliance → deploy → notify
  - Enterprise-grade security scanning: SAST, dependency audit, 8-pattern secret scanning, license compliance
  - Supply chain security validation with dependency review and package signature verification
  - Pipeline health monitoring with metrics collection and automated dashboard updates
  - Git hooks integration for local pre-commit and pre-push validation

- **Deployment Infrastructure (REQ-110)**  
  - Production-ready deployment workflow with environment protection
  - Canary deployment support with rollback capabilities
  - Package integrity validation and deployment artifact tracking
  - Automated npm registry deployment (dry-run enabled, ready for production)

- **Security & Compliance System (REQ-112)**
  - Advanced secret scanning with 8 comprehensive regex patterns
  - License compliance validation (MIT, Apache-2.0, BSD variants approved)
  - SAST analysis integration with ESLint security rules
  - Daily scheduled security scans and vulnerability database checks
  - Compliance reporting with artifact retention (90-365 days)

- **Monitoring & Observability (REQ-111)**
  - Pipeline health dashboard with success rate tracking (95% target)
  - Performance monitoring: CI <8min, Security <5min, Deploy <3min targets
  - Automated failure categorization with recovery mechanism suggestions
  - GitHub Step Summary integration for real-time pipeline status

### Enhanced
- **Test Infrastructure (REQ-109)**
  - Created `test/utils/github-actions-helpers.js` with 15 validation functions
  - Added `test/ci-cd/github-actions.spec.js` with comprehensive workflow testing
  - Implemented workflow parsing, matrix validation, security scanning verification
  - Added monitoring setup validation and deployment pipeline testing
  - Performance benchmark validation and artifact collection testing

### Documentation
- Created comprehensive `.github/README.md` with CI/CD domain documentation
- Added `.github/.claude-context` for complex CI/CD domain guidance
- Documented security patterns, deployment strategies, and troubleshooting
- Provided common tasks guide and gotchas for workflow maintenance

### Technical
- 6 GitHub Actions workflows: ci.yml, security.yml, dashboard.yml, pr-validation.yml, deploy.yml, release.yml
- Git hooks: pre-commit (format/lint/test/secret-scan) and pre-push (full validation)
- Progressive Documentation Guide compliant with domain-specific README and .claude-context
- TDD-compliant with REQ-ID traceability in all workflow comments
- Security-first design with least privilege permissions and secret management best practices

## [1.0.3] - 2025-09-11

### Added
- **Multi-Layered Testing Infrastructure (REQ-004, REQ-005, REQ-006, REQ-007, REQ-008)**
  - Created comprehensive `test/utils/test-constants.js` with parameterized values to eliminate hardcoded literals
  - Implemented 5 TDD-compliant utility modules with minimal stubs supporting meaningful failures
  - Added 82 new tests covering Unit → Integration → E2E → Performance → Error Boundary layers
  - Created macOS-specific error boundary testing for permissions, Gatekeeper, and file system behaviors
  - Added performance validation framework with <500ms CLI responsiveness thresholds

### Fixed
- **CLAUDE.md Standards Compliance (REQ-101, REQ-102, REQ-103, REQ-104)**
  - Eliminated all hardcoded literals from test files per Testing Best Practice #1
  - Fixed test utilities to provide meaningful TDD failures rather than import errors
  - Resolved missing function exports causing test execution failures
  - Ensured all test titles include proper REQ-ID references for traceability

### Changed
- **Test Organization (REQ-105)**
  - Restructured test directory with clear separation: utils/, integration/, e2e/, performance/, error-boundaries/
  - Maintained macOS testing focus with platform-specific path handling and permissions
  - Updated test execution to support TDD workflow with meaningful failure guidance

### Documentation
- Added comprehensive `test/README.md` documenting testing infrastructure patterns and TDD methodology
- Updated root README.md with testing layer descriptions and developer workflow guidance
- Enhanced project structure documentation to reflect testing architecture

### Technical
- All tests structured for TDD: 156 total (74 existing passing + 82 new meaningful TDD failures) ✅
- Zero linting warnings maintained ✅  
- Full parameterization compliance (no hardcoded literals) ✅
- Proper TDD methodology with requirements.lock pattern ✅

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