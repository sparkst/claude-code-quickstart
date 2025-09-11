# Requirements Lock (P1 Testing Infrastructure Fixes)
> Snapshot created: 2025-09-11
> Active task: Fix P1 critical issues in testing infrastructure identified during PE code review

## REQ-101: Fix Test Structure Violations of CLAUDE.md Standards

**Acceptance Criteria:**
- Remove all hardcoded literals from test files that violate CLAUDE.md Testing Best Practice #1
- Parameterize magic values like "test-prefix", 500ms thresholds, file paths, server names
- Replace hardcoded values with meaningful constants or test parameters
- Ensure test descriptions align with what is actually being tested
- Maintain REQ ID traceability in all test titles

**Current Violations Found:**
- `test-helpers.spec.js`: "test-prefix", hardcoded subdirectories ["claude", "node_modules", "src"]
- `cli-performance.spec.js`: 500ms, 750ms, 300ms, 50ms, 100ms, 200ms thresholds without justification
- `macos-errors.spec.js`: "/tmp/test-unsigned-binary", "444" permissions, hardcoded paths
- Multiple files: Hardcoded server names, configuration structures, and file paths

**Non-Goals:**
- Changing test logic or assertions
- Modifying REQ ID structure
- Breaking existing test functionality

## REQ-102: Simplify Unrealistic Utility Expectations

**Acceptance Criteria:**
- Reduce complex helper functions to minimal viable implementations that support TDD
- Remove sophisticated behaviors that require substantial implementation before TDD can work
- Create simple stub utilities that can fail meaningfully to guide implementation
- Focus on utilities that test real functionality rather than complex test infrastructure
- Preserve the intent of tests while making utility requirements realistic

**Unrealistic Expectations Found:**
- `createMockMcpServer` with complex defaults and server type detection
- `generateTestConfig` with sophisticated permission structures
- `validateMcpServerConfig` with platform-specific warnings and validation
- `createTestFixtures` with complex fixture generation and multiple server scenarios
- Performance helpers with detailed metrics, memory monitoring, and trend analysis

**Non-Goals:**
- Removing utility concepts entirely
- Changing test coverage goals
- Eliminating useful test functionality

## REQ-103: Implement Minimal Test Utilities for TDD Flow

**Acceptance Criteria:**
- Create basic utility files that allow tests to run and fail meaningfully
- Implement only the minimum functionality needed for tests to execute
- Ensure utilities provide clear failure points that guide implementation
- Maintain separation of concerns between different utility modules
- Follow TDD methodology: utilities should have meaningful failures first

**Required Utility Files:**
- `test/utils/test-helpers.js` - basic directory and config management
- `test/utils/performance-helpers.js` - simple timing measurements  
- `test/utils/error-simulation-helpers.js` - basic error simulation
- `test/utils/real-environment-helpers.js` - temp directory management
- `test/utils/e2e-helpers.js` - end-to-end test utilities

**Non-Goals:**
- Full feature implementation in utilities
- Complex test infrastructure beyond TDD needs
- Production-ready utility implementations

## REQ-104: Validate TDD Methodology Compliance

**Acceptance Criteria:**
- Tests fail for the RIGHT reasons (missing implementation) not wrong reasons (missing imports)
- All tests reference REQ IDs in titles per CLAUDE.md standards
- Tests follow TDD cycle: Red (fail) → Green (pass) → Refactor
- Maintain existing 74 passing tests without regression
- New tests guide implementation rather than assume implementation exists
- Tests are parameterized according to CLAUDE.md Testing Best Practice #1

**Current State Issues:**
- 5 test files with 104+ failing tests due to missing utility imports
- Tests assume complex implementation exists before TDD can begin
- Hardcoded literals violate parameterization standards
- Tests fail to load rather than fail to execute

**Non-Goals:**
- Changing existing working test methodology
- Modifying test framework or tools
- Breaking backward compatibility

## REQ-105: Maintain macOS Testing Focus

**Acceptance Criteria:**
- All testing utilities and scenarios remain focused on macOS platform
- Preserve macOS-specific path handling, permissions, and file system behaviors
- Maintain testing for macOS security features (Gatekeeper, sandboxing)
- Keep macOS development environment assumptions (Homebrew, npm paths)
- Test real macOS directory structures and conventions

**Non-Goals:**
- Cross-platform testing capabilities
- Windows or Linux compatibility
- Generic POSIX testing approach