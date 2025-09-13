# Current Requirements

## REQ-700: Sync template CLAUDE.md with updated root version
- Acceptance: Copy current root CLAUDE.md content to templates/CLAUDE.md
- Acceptance: New installations should get CLAUDE.md with qidea shortcut
- Acceptance: New installations should get MCP server integration guidelines
- Acceptance: Existing projects should remain unchanged (protected by fs.existsSync check)
- Non-Goals: Don't change template system architecture or scaffolding logic
- Notes: Simple content synchronization issue, not code logic change

## REQ-701: Verify new installations get complete CLAUDE.md content
- Acceptance: Test that scaffoldProjectFiles() creates CLAUDE.md with qidea shortcut
- Acceptance: Verify MCP server integration guidelines section is present
- Acceptance: Confirm all QShortcuts including qidea are documented
- Acceptance: Test in clean directory without existing CLAUDE.md
- Non-Goals: Don't test existing file overwrite protection (already works)
- Notes: Integration test to verify template content deployment

## REQ-702: Ensure backward compatibility for existing projects
- Acceptance: Existing CLAUDE.md files should never be overwritten 
- Acceptance: Users with older CLAUDE.md should not get forced updates
- Acceptance: Scaffolding should continue to respect fs.existsSync() logic
- Acceptance: No breaking changes to template system behavior
- Non-Goals: Don't implement migration or upgrade mechanism for existing files
- Notes: Leverages existing protection in scaffoldProjectFiles()

## REQ-703: Document template synchronization process
- Acceptance: Add note about keeping templates/ in sync with root files
- Acceptance: Document in appropriate README or development docs
- Acceptance: Explain template system for maintainers
- Acceptance: Clarify when templates need manual updates
- Non-Goals: Don't create complex automation for template sync
- Notes: Simple documentation addition for maintainer guidance