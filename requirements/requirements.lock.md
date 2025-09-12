# Requirements Lock - Cloudflare SSE MCP Security & Quality Fixes

## REQ-400: Security - URL Parameter Validation (P1 Critical)
- Acceptance: Validate SSE URL parameters in buildClaudeMcpCommand before using them
- Acceptance: Sanitize URLs to prevent command injection vulnerabilities 
- Acceptance: Only allow HTTPS URLs from trusted domains (*.cloudflare.com, localhost for dev)
- Acceptance: Reject URLs with shell metacharacters, path traversal, or injection attempts
- Acceptance: Return clear error messages for invalid URLs rather than failing silently
- Notes: Critical security issue - URL params passed directly to shell without validation

## REQ-401: Missing Logic - SSE Server Routing (P1 Critical)
- Acceptance: Add missing promptSSEServerForCommand routing in configureClaudeCode() switch statement
- Acceptance: Ensure SSE servers are processed by correct prompt handler, not falling through to standard
- Acceptance: Route spec.promptType === "sse" to promptSSEServerForCommand function
- Acceptance: Maintain existing routing patterns for other promptTypes (path, wrangler, dual)
- Notes: Currently SSE servers fall through to default case and receive incorrect handling

## REQ-402: User Guidance - Fix Misleading Messages (P1 Critical) 
- Acceptance: Remove or correct misleading "npx wrangler login doesn't work with MCP servers" message
- Acceptance: Provide accurate guidance that wrangler login IS required for the original cloudflare server
- Acceptance: Clarify distinction between cloudflare (wrangler) vs cloudflare-bindings/builds (SSE) servers
- Acceptance: Update user messaging to be specific about which authentication method applies to which server
- Notes: Current messaging confuses users about wrangler authentication requirements

## REQ-403: Documentation - Invalid REQ Reference (P1 Critical)
- Acceptance: Remove or correct REQ-303 comment that references non-existent requirement
- Acceptance: Ensure all REQ ID comments in code map to actual requirements in requirements.lock.md
- Acceptance: Update comment to reference correct requirement ID (REQ-400 or REQ-401)
- Acceptance: Establish process to validate REQ ID consistency between code and docs
- Notes: Code references REQ-303 but requirement doesn't exist in requirements documentation

## REQ-404: Maintainability - Single Responsibility (P2 Should Fix)
- Acceptance: Refactor buildClaudeMcpCommand to separate URL handling from command building
- Acceptance: Extract URL validation into validateSSEUrl(url) function with clear error handling
- Acceptance: Extract SSE command building into buildSSECommand(spec, scope) function
- Acceptance: Maintain backward compatibility while improving code organization
- Notes: Function currently violates SRP by handling both validation and command construction

## REQ-405: Testing - Real Integration Coverage (P2 Should Fix)
- Acceptance: Update integration tests to verify actual SERVER_SPECS array content, not file string matching
- Acceptance: Test actual prompt routing behavior, not just string presence in source code
- Acceptance: Create helper functions to validate SERVER_SPECS entries match expected schema
- Acceptance: Test end-to-end SSE server configuration flow with mock execSync
- Notes: Current tests only verify source code contains strings, not functional behavior

## REQ-406: Performance - Efficient Server Lookup (P2 Should Fix)
- Acceptance: Replace O(n) search in showPostSetupGuide with efficient lookup mechanism
- Acceptance: Create hasCloudflareSSEServers boolean flag set during configuration
- Acceptance: Cache server type information to avoid repeated linear searches
- Acceptance: Maintain same user experience while improving performance
- Notes: showPostSetupGuide checks for Cloudflare SSE servers using slow O(n) search every time

## REQ-407: Organization - Clear Server Type Structure (P2 Should Fix)  
- Acceptance: Organize SERVER_SPECS array by server type (npm, wrangler, sse, path)
- Acceptance: Add clear comments delineating server type sections
- Acceptance: Group related servers together for better maintainability
- Acceptance: Ensure consistent properties within each server type group
- Notes: Current array mixes different server types without clear organization or patterns