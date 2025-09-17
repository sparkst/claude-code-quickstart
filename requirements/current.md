# Current Requirements: P0/P1 Critical Fixes Implementation

## REQ-701: Critical execSync Array Bug Fix (P0 - COMPLETED)
- **Acceptance**: execSync receives properly formatted string command instead of array
- **Details**: buildClaudeMcpCommand returns array but execSync expects string, causing TypeError
- **Impact**: All SSE-based MCP server installations fail silently with generic error message
- **Status**: ✅ COMPLETED - Fixed in v1.1.1
- **Non-Goals**: Not fixing npm-based servers (they work correctly)
- **Notes**: This was the root cause of "❌ Cloudflare Bindings installation failed" errors

## REQ-709: Undefined Variable Bug Fix (P0)
- **Acceptance**: CLI executes without ReferenceError in debug mode
- **Details**: Variable `commandString` used on line 686 but only defined inside debug condition on line 678
- **Impact**: CLI crashes with ReferenceError when installing MCP servers in debug mode
- **Fix**: Move commandString declaration outside debug condition
- **Estimated Time**: 1 hour
- **Dependencies**: None

## REQ-710: Missing Test Infrastructure Functions (P0)
- **Acceptance**: All 223 test infrastructure functions implemented and tests passing
- **Details**: Core test utilities like createTestEnvironment() are referenced but not implemented
- **Impact**: Blocks development workflow with failing test suite
- **Requirements**:
  - Implement createTestEnvironment() following TypeScript interfaces
  - Add createFile(), createDirectory(), cleanup() functions
  - Implement workflow-validator.js functionality
  - Verify all infrastructure tests pass
- **Estimated Time**: 6 hours
- **Dependencies**: Complete TypeScript interface definitions

## REQ-711: UX Choice Overload Resolution (P0)
- **Acceptance**: Setup flow uses tiered onboarding with progressive disclosure
- **Details**: Replace 8+ simultaneous MCP server decisions with guided tiers
- **Impact**: Reduce 60-80% user abandonment during setup
- **Requirements**:
  - **Quick Start** (2 min): Context7, Tavily, GitHub - essential productivity tools
  - **Dev Tools** (5 min): Cloudflare, Supabase, n8n, PostgreSQL + Quick Start - full dev workflow
  - **Full Setup** (8 min): Brave Search + Dev Tools - comprehensive suite
  - Implement UI-only grouping with clear descriptions and time estimates
  - Add progressive disclosure: "Need more servers? [Show Dev Tools]"
  - Improve post-install messaging with next steps per server type
- **Estimated Time**: 6 hours
- **Dependencies**: None (UI-only changes, no MCP integration changes)

## REQ-712: Authentication Messaging Enhancement (P1)
- **Acceptance**: Clear upfront communication about authentication requirements per server
- **Details**: Replace authentication maze with clear guidance and post-install instructions
- **Impact**: Reduce cognitive chaos during server configuration
- **Requirements**:
  - **Better Server Descriptions**: Clear auth requirements per server
    - Simple servers: "🔑 Needs: API Access Token (2 min setup)"
    - SSE servers: "🌐 Needs: Browser authentication + Claude Code setup (3 min)"
    - Complex servers: "⚙️ Needs: URL + credentials (5 min setup)"
  - **Enhanced Post-Install Guidance**:
    - "✅ Supabase configured → Ready to use immediately"
    - "✅ Cloudflare installed → NEXT: Run `/mcp cloudflare-bindings` in Claude Code"
  - **Real-time Format Validation**: Basic API key format checking
- **Estimated Time**: 2 hours
- **Dependencies**: None (UI copy and messaging improvements only)

## REQ-713: Function Complexity Reduction (P1)
- **Acceptance**: buildClaudeMcpCommand function split into single-responsibility functions
- **Details**: Reduce 15+ execution paths and high cyclomatic complexity
- **Impact**: Improve testability and maintainability
- **Requirements**:
  - Split into separate functions: buildSSECommand, buildNpmCommand, dispatcher
  - Create transport-specific command builders
  - Add comprehensive unit tests for each function
  - Refactor error handling to use typed errors
- **Estimated Time**: 6 hours
- **Dependencies**: Complete test coverage for existing functionality

## REQ-714: REQ-ID Test Coverage Implementation (P1)
- **Acceptance**: All requirements in requirements.lock.md have corresponding failing tests
- **Details**: Ensure TDD compliance - requirements without tests violate methodology
- **Impact**: Critical for maintaining TDD discipline and requirement traceability
- **Requirements**:
  - Create comprehensive failing tests for REQ-702, REQ-703, REQ-704
  - Implement property-based tests for validation functions
  - Add integration tests for authentication workflows
  - Verify all tests reference correct REQ-IDs in titles
- **Estimated Time**: 8 hours
- **Dependencies**: Requirements finalization

## REQ-715: File Locking for Concurrent Access (P1 - COMPLETED)
- **Acceptance**: Race conditions eliminated in global settings.json modifications
- **Details**: Implement concurrency control for shared configuration files
- **Impact**: Prevent configuration corruption during concurrent installations
- **Status**: ✅ COMPLETED - All requirements implemented and tested
- **Requirements**:
  - ✅ Implement file locking using proper-lockfile library
  - ✅ Add concurrent access safety to configuration updates
  - ✅ Create user session isolation mechanisms
  - ✅ Add integration tests for concurrent scenarios
- **Implementation**:
  - Added proper-lockfile dependency
  - Created safeConfigUpdate() helper with lock management
  - Wrapped all file operations with lock protection
  - Added timeout, retry logic, and user feedback
  - Created comprehensive test suites for concurrent scenarios
- **Dependencies**: proper-lockfile dependency addition

## REQ-702: Enhanced Error Reporting and Diagnostics (LEGACY - SUPERSEDED)
- **Status**: ⚠️ SUPERSEDED by REQ-712 (Authentication Messaging Enhancement)
- **Acceptance**: Installation failures show specific error messages instead of generic failure text
- **Details**: Catch and log actual error details from execSync failures
- **Impact**: Users can understand what went wrong and how to fix it
- **Requirements**:
  - Log the exact command being executed
  - Log the actual error message from execSync
  - Distinguish between different failure types (command not found, authentication, syntax errors)
- **Non-Goals**: Not implementing retry logic or automatic fixes

## REQ-703: SSE Command Building Validation
- **Acceptance**: buildSSECommand creates valid claude mcp add commands for SSE transport
- **Details**: Ensure URL validation, scope handling, and parameter ordering work correctly
- **Requirements**:
  - Validate URL format and HTTPS requirement
  - Handle scope parameter correctly (user, project, local)
  - Generate proper command structure: claude mcp add [--scope X] --transport sse <key> <url>
- **Non-Goals**: Not changing the SSE URL endpoints or authentication flow

## REQ-704: Claude CLI Integration Verification
- **Acceptance**: Verify claude command is available and has required MCP functionality
- **Details**: Check claude CLI installation, version compatibility, and mcp subcommand availability
- **Requirements**:
  - Detect if claude command is in PATH
  - Verify claude mcp add command exists
  - Check for required permissions and authentication
- **Non-Goals**: Not installing or updating Claude CLI automatically

## REQ-705: Environment and Dependencies Audit
- **Acceptance**: Comprehensive check of installation environment and requirements
- **Details**: Validate all prerequisites for MCP server installation are met
- **Requirements**:
  - Check Node.js version compatibility
  - Verify filesystem permissions for ~/.claude directory
  - Validate network connectivity to Cloudflare SSE endpoints
  - Check for conflicting MCP server configurations
- **Non-Goals**: Not modifying system environment automatically

## REQ-706: Server Configuration and Authentication Analysis
- **Acceptance**: Deep analysis of Cloudflare server specifications and authentication flow
- **Details**: Examine SSE transport configuration and Claude Code authentication requirements
- **Requirements**:
  - Validate SERVER_SPECS configuration for Cloudflare servers
  - Document expected authentication flow for SSE servers
  - Verify transport=sse parameter handling
  - Test manual installation methods as validation
- **Non-Goals**: Not changing authentication requirements or server endpoints

## REQ-707: Comprehensive Troubleshooting Guide
- **Acceptance**: Complete debugging guide with specific commands and solutions
- **Details**: Step-by-step troubleshooting for common installation failure scenarios
- **Requirements**:
  - Manual installation commands for each Cloudflare server
  - Diagnostic commands to identify specific failure causes
  - Recovery procedures for partially failed installations
  - Verification steps to confirm successful installation
- **Non-Goals**: Not creating automated repair tools

## REQ-708: Multi-Agent Investigation Framework
- **Acceptance**: Structured approach for specialized agents to investigate specific areas
- **Details**: Define clear investigation boundaries and responsibilities for each debugging agent
- **Requirements**:
  - Agent 1: SSE Command Building & Execution (REQ-701, REQ-703)
  - Agent 2: Claude MCP CLI Integration (REQ-704, REQ-702)
  - Agent 3: Server Configuration & Authentication (REQ-706)
  - Agent 4: Environment & Dependencies (REQ-705)
  - Agent 5: Error Reporting & Diagnostics (REQ-702, REQ-707)
- **Non-Goals**: Not overlapping investigation areas between agents