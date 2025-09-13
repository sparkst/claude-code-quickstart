# Current Requirements - Test Infrastructure Fixes

## REQ-500: Missing Test Utilities Infrastructure (P1 Critical)
- Acceptance: All required TypeScript test utility modules exist and pass type checking
- Need: createCliExecutor, createTestEnvironment, createWorkflowValidator, createUserSimulator, createSecurityValidator, createProcessManager functions
- Impact: E2E tests fail because import statements reference non-existent modules
- Files needed: test/utils/cli-executor.ts, test/utils/test-environment.ts, test/utils/workflow-validator.ts, test/utils/user-simulator.ts, test/utils/security-validator.ts, test/utils/process-manager.ts, test/utils/e2e-types.ts

## REQ-501: CLI MCP Integration Missing Functions (P1 Critical)
- Acceptance: bin/cli-mcp.spec.js tests pass with actual CLI implementation containing required functions
- Need: promptSSEServerForCommand, validateSSEUrl, buildClaudeMcpCommand with SSE transport support
- Impact: 23 failed tests in bin/cli-mcp.spec.js looking for SSE server integration
- Current: Tests check actual CLI content but functions are missing or incomplete

## REQ-502: Security Validation Missing Implementation (P1 Critical)
- Acceptance: Security validation functions prevent command injection, path traversal, and unsafe operations
- Need: validateSSEUrl function with domain whitelist, command sanitization, path validation
- Impact: Security tests fail because validation functions don't exist
- Test expectation: Functions should throw errors for malicious inputs

## REQ-503: Real Process Execution vs Simulation (P1 Critical)
- Acceptance: CLI executor uses real subprocess execution, not simulation responses
- Need: Remove simulateCliExecution and simulateFirstTimeUser functions, implement real child_process.spawn
- Impact: Tests expect real CLI behavior but get hardcoded simulation responses
- Current: e2e-helpers.js contains simulation code that needs replacement

## REQ-504: Test Infrastructure TypeScript Migration (P1 Critical)
- Acceptance: All test utilities migrated from JavaScript to TypeScript with proper interfaces
- Need: Complete migration from e2e-helpers.js to modular TypeScript architecture
- Impact: Infrastructure refactoring tests expect TS modules but find JS monolith
- Target: Decompose 1000+ line e2e-helpers.js into focused <300 line TypeScript modules

## REQ-505: GitHub Actions CI/CD Test Failures (P2 Should Fix)
- Acceptance: CI/CD pipeline tests pass with proper metrics and monitoring
- Need: Fix 10 failing tests in test/ci-cd/github-actions.spec.js
- Impact: Pipeline validation tests expect specific failure mechanisms and metrics
- Current: Tests fail on retry mechanisms, monitoring metrics, security scanning

## REQ-506: Real Environment Integration Tests (P2 Should Fix)
- Acceptance: Integration tests work with actual file system, npm, and network operations
- Need: Remove mocked directory creation, file operations, and npm package validation
- Impact: Tests expect real filesystem changes but get simulation
- Current: Multiple tests fail expecting real CLI execution results

## REQ-507: Security Hardening Test Coverage (P2 Should Fix)
- Acceptance: Comprehensive security tests prevent injection attacks and validate all inputs
- Need: Command injection prevention, path traversal protection, environment variable sanitization
- Impact: Security vulnerability tests fail because protection doesn't exist
- Coverage: Need tests for malicious commands, paths, environment variables, and buffer overflow

## REQ-508: Error Handling and Resource Management (P2 Should Fix)
- Acceptance: Robust error handling prevents resource leaks and handles edge cases gracefully
- Need: Process cleanup, file cleanup, race condition prevention, comprehensive error recovery
- Impact: Resource management tests fail due to missing cleanup and error handling
- Test scenarios: Process timeouts, file permission errors, disk full, network timeouts

## REQ-509: TDD Compliance for E2E Infrastructure (P2 Should Fix)
- Acceptance: All functions have failing tests before implementation, tests reference REQ IDs
- Need: Ensure failing tests exist for each PE-Reviewer finding before implementation
- Impact: TDD process expects failing tests but some implementations may exist without tests
- Coverage: Tests must cite REQ IDs and cover monolithic architecture, simulation, security, resource leaks

## REQ-510: Performance and Architecture Improvements (P3 Nice to Have)
- Acceptance: Optimized server lookups, clear module organization, efficient caching
- Need: Replace O(n) searches with boolean flags, organize SERVER_SPECS by type, implement caching
- Impact: Performance tests expect efficient operations but find inefficient implementations
- Target: Sub-linear server lookups, modular organization, resource caching

## Non-Goals
- Complete rewrite of existing working functionality
- Breaking changes to public CLI interface
- Performance optimizations that compromise security
- Complex architectural changes beyond modular decomposition

## Notes
- Focus on infrastructure first - get tests passing before feature additions
- Maintain backward compatibility during migration
- Security fixes take priority over performance optimizations
- E2E tests should use real processes, not simulation
- TypeScript migration must preserve existing functionality