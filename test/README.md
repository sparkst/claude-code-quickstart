# Testing Infrastructure

## Purpose
Multi-layered testing architecture following strict TDD methodology with parameterized constants, meaningful failures, and macOS-specific testing capabilities.

## Boundaries
**In Scope:**
- Unit, integration, E2E, and performance testing
- macOS-specific error boundary testing  
- TDD-compliant test utilities with meaningful failures
- Parameterized constants (zero hardcoded literals per CLAUDE.md)
- REQ-ID traceability in all test titles

**Out of Scope:**
- Cross-platform testing (Windows/Linux)
- Production-ready utility implementations
- Complex test infrastructure beyond TDD needs

## Key Files
- `utils/test-constants.js` — Parameterized values for all tests (no hardcoded literals)
- `utils/test-helpers.js` — Basic test utilities for TDD flow
- `utils/performance-helpers.js` — Performance measurement (<500ms thresholds)
- `utils/error-simulation-helpers.js` — Error testing and simulation
- `utils/real-environment-helpers.js` — Temp directory and environment management
- `utils/e2e-helpers.js` — End-to-end test utilities

## Testing Layers
1. **Unit Tests** — Function-level testing with parameterized inputs
2. **Integration Tests** — Real MCP server connections and configurations  
3. **E2E Tests** — Full CLI workflow validation
4. **Performance Tests** — CLI responsiveness validation (<500ms startup)
5. **Error Boundary Tests** — macOS-specific error handling (permissions, Gatekeeper)

## TDD Methodology
All tests follow strict TDD compliance:
- **Red Phase** — Meaningful test failures that guide implementation
- **Green Phase** — Minimal implementation to pass tests
- **Refactor Phase** — Clean up with maintained test coverage

Test utilities are designed as minimal stubs that:
- Allow tests to execute and fail meaningfully
- Provide clear guidance for what needs to be implemented
- Follow parameterization standards (no hardcoded literals)

## Common Tasks
- **Add new test category**: Create in appropriate subdirectory with REQ-ID titles
- **Add parameterized constant**: Update `utils/test-constants.js`
- **Create test utility**: Start with minimal stub in relevant `utils/` file
- **Run specific tests**: `npm test -- test/[category]/` 
- **TDD development**: `npm test -- --watch` for continuous feedback

## Gotchas
- All test titles MUST include REQ-ID references (e.g., "REQ-004 — ...")
- No hardcoded literals allowed - use `test-constants.js` parameterized values
- macOS-specific paths and permissions must use constants from `MACOS_PATHS`
- Test utilities should fail meaningfully before implementation exists
- Performance thresholds based on CLI responsiveness requirements (not arbitrary)

## Dependencies
- **Upstream**: `requirements/requirements.lock.md` for REQ-ID definitions
- **Downstream**: CLI implementation in `bin/cli.js` for integration testing
- **External**: Mocha test framework, MCP servers for integration tests