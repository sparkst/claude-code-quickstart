# Testing Infrastructure

## Purpose
Production-ready multi-layered testing architecture following strict TDD methodology with TypeScript modular design, real subprocess execution, comprehensive security validation (70+ tests), and macOS-specific testing capabilities. Complete migration from simulation-based testing to real CLI process execution supporting TDD workflow with meaningful failures.

## Boundaries
**In Scope:**
- **TypeScript Test Architecture (REQ-500)** — Modular design replacing 1000+ line JavaScript monolith
- **Real CLI Execution (REQ-503)** — Actual subprocess execution via child_process.spawn (no simulation)
- **CLI Integration Testing (REQ-501)** — MCP command building, SSE transport, and server configuration
- **Security Validation (REQ-502)** — Command injection prevention, path traversal protection, domain validation
- Unit, integration, E2E, performance, and security validation testing
- Comprehensive security test suite with 70+ tests covering URL validation and command injection prevention
- macOS-specific error boundary testing with proper resource cleanup
- TDD-compliant test utilities with meaningful failures and REQ-ID traceability
- Parameterized constants (zero hardcoded literals per CLAUDE.md)
- Environment management with automatic cleanup preventing test pollution

**Out of Scope:**
- Cross-platform testing (Windows/Linux) — focused on macOS development environment
- Production-ready utility implementations — test stubs support TDD workflow only
- Complex test infrastructure beyond TDD needs — simplicity over feature completeness
- **Simulation Responses (REQ-503)** — removed hardcoded simulation, all tests use real CLI execution

## Key Files

### Core Test Utilities (Legacy JavaScript)
- `utils/test-constants.js` — Parameterized values for all tests (no hardcoded literals)
- `utils/test-helpers.js` — Basic test utilities for TDD flow
- `utils/performance-helpers.js` — Performance measurement (<500ms thresholds)
- `utils/error-simulation-helpers.js` — Error testing and simulation
- `utils/real-environment-helpers.js` — Temp directory and environment management
- `utils/e2e-helpers.js` — End-to-end test utilities (legacy)

### TypeScript Test Infrastructure (REQ-500-503)
- `utils/cli-executor.ts` — Real CLI subprocess execution and monitoring (REQ-503)
- `utils/cli-executor.js` — JavaScript compatibility layer for mixed environments
- `utils/test-environment.ts` — Environment management with proper resource cleanup (REQ-500)
- `utils/test-environment.js` — JavaScript compatibility layer
- `utils/e2e-types.ts` — Comprehensive TypeScript interfaces and type definitions (REQ-500)
- `utils/workflow-validator.spec.ts` — Workflow validation testing with real execution
- `utils/security-validation-missing.spec.ts` — Security validation test suite (REQ-502)
- `utils/real-process-execution.spec.ts` — Real execution testing replacing simulation (REQ-503)
- `utils/cli-mcp-integration.spec.ts` — CLI MCP integration testing (REQ-501)
- `utils/cli-executor-factory.spec.ts` — Factory pattern testing for CLI execution
- `utils/test-environment.spec.ts` — Environment testing with cleanup validation

## Testing Layers

### 1. Unit Tests
- Function-level testing with parameterized inputs (no hardcoded literals)
- TypeScript interfaces and type validation
- Individual utility function testing with meaningful failures

### 2. Security Tests (REQ-502)
- **Command Injection Prevention** — Shell metacharacter filtering and validation
- **Path Traversal Protection** — Directory traversal attack prevention
- **Domain Validation** — Trusted domain allowlist enforcement (*.mcp.cloudflare.com, localhost)
- **URL Validation** — HTTPS enforcement and comprehensive security checks
- **Buffer Overflow Protection** — Subprocess communication safeguards
- 70+ comprehensive security validation tests

### 3. Integration Tests (REQ-501, REQ-503)
- **Real MCP Server Integration** — Actual CLI execution via child_process.spawn
- **SSE Transport Testing** — Server-sent events configuration and validation
- **Command Building** — Array-based command construction preventing injection
- **Environment Integration** — Real filesystem, npm, and network operations

### 4. E2E Tests (REQ-503)
- **Full CLI Workflow Validation** — Complete setup and configuration flows
- **Real Process Execution** — No simulation responses, actual subprocess monitoring
- **Resource Cleanup** — Proper cleanup preventing test pollution
- **Error Recovery** — Comprehensive error handling and recovery testing

### 5. Performance Tests
- **CLI Responsiveness** — <500ms startup and execution validation
- **Resource Efficiency** — Memory and CPU usage monitoring
- **Subprocess Management** — Efficient process spawning and monitoring

### 6. Error Boundary Tests
- **macOS-specific Error Handling** — Permissions, Gatekeeper, and platform constraints
- **Resource Management** — File cleanup, process cleanup, race condition prevention
- **Network Timeout Handling** — Connection failures and recovery mechanisms

## TDD Methodology

### Traditional TDD Flow
All tests follow strict TDD compliance:
- **Red Phase** — Meaningful test failures that guide implementation
- **Green Phase** — Minimal implementation to pass tests
- **Refactor Phase** — Clean up with maintained test coverage

### TypeScript Migration Approach (REQ-500-503)
Test utilities follow a dual-approach during migration:

**1. Legacy JavaScript Support**
- Minimal stubs that allow tests to execute and fail meaningfully
- Clear guidance for what needs to be implemented
- Parameterization standards (no hardcoded literals)

**2. TypeScript Implementation**
- Comprehensive type definitions with strict mode compliance
- Real subprocess execution replacing simulation responses
- Modular architecture with focused responsibilities (<300 lines per module)
- Resource cleanup and error handling for production-grade reliability

### Test Infrastructure Strategy
- **Real Execution First** — All new tests use actual CLI subprocess execution
- **Backwards Compatibility** — JavaScript compatibility layers maintain existing test functionality
- **Security by Design** — All new utilities include comprehensive security validation
- **REQ-ID Traceability** — Every test references specific requirement IDs for accountability

## Common Tasks

### Development Workflow
- **Add new test category**: Create in appropriate subdirectory with REQ-ID titles
- **Add parameterized constant**: Update `utils/test-constants.js`
- **Create TypeScript test utility**: Use modular architecture with comprehensive types
- **Create JavaScript compatibility layer**: Ensure mixed environments work properly
- **Run specific tests**: `npm test -- test/[category]/` or specific .ts/.js files
- **TDD development**: `npm test -- --watch` for continuous feedback with TypeScript compilation

### TypeScript Test Development (REQ-500-503)
- **Start with Types**: Define interfaces in `e2e-types.ts` first
- **Real Execution**: Use `cli-executor.ts` for actual subprocess execution
- **Environment Management**: Use `test-environment.ts` for proper setup/cleanup
- **Security Validation**: Include security checks in all new utilities
- **REQ-ID References**: Ensure all test titles include relevant requirement IDs

### Migration Patterns
- **Legacy to TypeScript**: Maintain JavaScript compatibility during transition
- **Simulation to Real**: Replace hardcoded responses with actual CLI execution
- **Monolithic to Modular**: Break large files into focused modules (<300 lines)
- **Stub to Implementation**: Upgrade minimal stubs to production-grade utilities

## Gotchas

### General Testing Requirements
- All test titles MUST include REQ-ID references (e.g., "REQ-500 — ...")
- No hardcoded literals allowed - use `test-constants.js` parameterized values
- macOS-specific paths and permissions must use constants from `MACOS_PATHS`
- Test utilities should fail meaningfully before implementation exists
- Performance thresholds based on CLI responsiveness requirements (not arbitrary)

### TypeScript Migration Gotchas (REQ-500-503)
- **Compilation Dependencies**: Ensure TypeScript utilities compile before test execution
- **Mixed Environments**: Maintain both .ts and .js versions during transition
- **Real Execution**: No simulation responses allowed - all tests must use actual subprocess execution
- **Resource Cleanup**: Always use proper cleanup to prevent test pollution and resource leaks
- **Security Validation**: Include comprehensive security checks in all new utilities
- **Type Safety**: Use strict TypeScript mode with comprehensive interface definitions

### Common Pitfalls
- **Simulation Reliance**: Avoid reverting to hardcoded simulation responses
- **Resource Leaks**: Ensure all spawned processes and temporary files are cleaned up
- **Security Bypass**: Never skip security validation for "convenience" or testing
- **Monolithic Growth**: Keep modules focused and under 300 lines
- **REQ-ID Drift**: Maintain accurate requirement ID references as requirements evolve

## Dependencies

### Upstream Dependencies
- **Requirements**: `requirements/requirements.lock.md` for REQ-ID definitions and acceptance criteria
- **CLAUDE.md**: Testing best practices and TDD methodology compliance
- **TypeScript Config**: tsconfig.json for strict mode compilation and type checking

### Downstream Dependencies
- **CLI Implementation**: `bin/cli.js` for integration testing and real subprocess execution
- **Security Functions**: `validateSSEUrl`, `buildClaudeMcpCommand` for security validation testing
- **MCP Servers**: External server packages for integration and E2E testing

### External Dependencies
- **Test Framework**: Mocha test framework with TypeScript support
- **Process Management**: Node.js child_process for real CLI execution
- **Environment Management**: Temporary directory creation and cleanup utilities
- **Security Testing**: External services for injection attack validation

### Development Dependencies (REQ-500-503)
- **TypeScript Compiler**: For .ts test utility compilation and type checking
- **JavaScript Compatibility**: Node.js compatibility for mixed .ts/.js environments
- **Resource Management**: Process cleanup and file system management libraries
- **Security Validation**: Input sanitization and domain validation dependencies