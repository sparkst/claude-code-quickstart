# Requirements Management

## Purpose
Requirements tracking and TDD compliance for Claude Code Quickstart. Implements the requirements.lock pattern from CLAUDE.md to ensure all features are properly documented and tested before implementation.

## Boundaries
**In Scope:**
- REQ-ID assignment and tracking
- Acceptance criteria definition
- Requirements lock snapshots for active work
- Test-to-requirement traceability

**Out of Scope:**
- Implementation details (documented in code and README)
- User stories or product requirements (focused on technical requirements)
- Release planning or roadmaps

## Key Files
- `current.md` — Active requirements being worked on
- `requirements.lock.md` — Snapshot of requirements for current task/iteration
- `README.md` — This documentation of the requirements process

## Patterns

### REQ-ID Format
- `REQ-XXX` where XXX is a sequential number
- Must be referenced in test titles: `test("REQ-001 — feature works correctly")`
- Group related requirements by functional area

### Requirements Lock Pattern
1. Update `current.md` with new requirements
2. Snapshot to `requirements.lock.md` when starting implementation
3. Write failing tests that reference REQ-IDs from the lock
4. Implement minimal code to satisfy the failing tests
5. Verify all REQ-IDs in lock have corresponding test coverage

### Test References
```javascript
// Good - includes REQ-ID
test("REQ-001 — Tavily server uses correct package name", () => {
  // test implementation
});

// Bad - no REQ-ID traceability  
test("tavily works", () => {
  // test implementation  
});
```

## Dependencies
**Upstream:**
- CLAUDE.md TDD methodology and best practices
- Agent system for planner, test-writer, docs-writer workflows

**Downstream:**
- All test files must reference REQ-IDs in test titles
- CHANGELOG.md should reference REQ-IDs for traceability
- Code reviews should verify REQ-ID coverage

## Common Operations

### Starting New Feature Work
1. Define requirements in `current.md` with clear acceptance criteria
2. Run `cp current.md requirements.lock.md` to create snapshot
3. Use test-writer agent to create failing tests for each REQ-ID
4. Implement minimal code to satisfy tests
5. Verify all REQ-IDs have corresponding test coverage

### Updating Requirements
1. Modify `current.md` with changes
2. Create new snapshot: `cp current.md requirements.lock.md`  
3. Update or add tests for new/changed REQ-IDs
4. Ensure backward compatibility or plan breaking changes

### Requirements Review
- Every REQ-ID should have at least one corresponding test
- Test titles should clearly state what is being verified
- Acceptance criteria should be testable and specific
- Non-goals should be explicitly documented to prevent scope creep