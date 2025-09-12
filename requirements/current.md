# Current Requirements

## REQ-500: Smart Server Detection and Status Display
- **Acceptance Criteria:**
  - Pre-check if SSE servers (Supabase, GitHub, etc.) already exist before installation
  - Display differentiated status messages: "✓ Already configured", "⚠️ Needs authentication", "❌ Failed"
  - Avoid showing error messages for successfully configured servers
  - Provide contextual next steps based on server status
  - Replace generic "Failed" status with specific failure reasons
- **Non-Goals:** 
  - Auto-fixing authentication issues
  - Modifying existing server configurations without user consent
- **Notes:** 
  - Current UX shows "❌ Failed" even for working servers due to "already exists" condition
  - Users are confused when verification shows "✓ Connected" after seeing failure

## REQ-501: Enhanced Post-Setup Experience and Guidance
- **Acceptance Criteria:**
  - List all installed components (MCP servers, agents) with clear descriptions of their purposes
  - Explain CLAUDE.md role and how it guides Claude Code behavior
  - Provide practical q* shortcut examples with real-world use cases
  - Remove generic "Pro Tips" section in favor of specific actionable guidance
  - Include next steps tailored to what was actually installed
- **Non-Goals:**
  - Overwhelming users with every possible feature
  - Generic documentation that applies to all setups
- **Notes:**
  - Current post-setup guide is too generic and doesn't reflect what was actually installed

## REQ-502: CLAUDE.md MCP Server Integration Guidelines
- **Acceptance Criteria:**
  - Update CLAUDE.md template with specific guidance for each MCP server type
  - Include practical examples: Supabase for DB operations, GitHub for repo management, etc.
  - Define clear boundaries for when to use which server
  - Integrate MCP server usage into existing q* shortcut workflows
  - Provide context on server capabilities within TDD workflow
- **Non-Goals:**
  - Replacing existing CLAUDE.md structure
  - Adding MCP-specific shortcuts that conflict with existing ones
- **Notes:**
  - Current CLAUDE.md doesn't mention MCP servers or how they integrate with workflows

## REQ-503: qidea Shortcut for Zero-Code Research and Ideation
- **Acceptance Criteria:**
  - Add "qidea" shortcut to CLAUDE.md QShortcuts section
  - Define as research and ideation tool for "whiteboarding with a top engineer"
  - Focus on architecture options, UX recommendations, testing strategies
  - Explicitly prohibit code output - pure strategic/research focus
  - Include in agent activation guidance for appropriate agent selection
- **Non-Goals:**
  - Producing implementation code
  - Overlapping with existing planning shortcuts (QNEW/QPLAN)
- **Notes:**
  - Fills gap between high-level planning and implementation phases

## REQ-504: UX Flow State Machine for Server Management
- **Acceptance Criteria:**
  - Implement clear state transitions: Not Installed → Installing → Configured → Authenticated → Ready
  - Provide appropriate user actions for each state
  - Show progress indicators during installation/configuration
  - Handle error states with specific recovery actions
  - Cache server status to avoid repeated checks
- **Non-Goals:**
  - Auto-recovery from all error states
  - Real-time status monitoring
- **Notes:**
  - Current flow lacks clear state management and user feedback