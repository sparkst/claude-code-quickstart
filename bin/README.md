# CLI Implementation

## Purpose
Production-ready CLI implementation that orchestrates MCP server configuration, project scaffolding, and Claude Code setup. Features smart server detection to avoid false failure messages, enhanced post-setup experience with specific component listings, comprehensive MCP integration guidelines for zero-code research workflows, and robust security validation with real subprocess execution for testing.

## Boundaries
**In Scope:**
- Smart MCP server detection with `checkServerStatus()` to avoid false failure messages during setup
- Enhanced post-setup experience with `showPostSetupGuide()` providing specific component listings and practical examples
- Interactive user prompts for API keys and settings with masked re-entry support
- Template processing and file scaffolding with TDD methodology and comprehensive MCP integration guidelines
- Template synchronization ensuring new installations get latest CLAUDE.md with qidea shortcut and MCP guidance
- Advanced environment validation and security enforcement with comprehensive threat prevention
- Agent registration with Claude Code including zero-code research workflow (qidea)
- **Security Validation (REQ-502)** — Command injection prevention, path traversal protection, domain validation
- **CLI Integration (REQ-501)** — Real subprocess execution, SSE transport support, MCP command building
- **Test Infrastructure (REQ-500, REQ-503)** — TypeScript utilities, real process execution, environment management
- Server conflict resolution (fixed "MCP server cloudflare already exists" errors)
- URL validation with comprehensive security checks for legitimate https:// URLs

**Out of Scope:**
- Actual MCP server implementations (delegates to external packages)
- Claude Code runtime behavior (only configures)
- Network operations beyond basic validation

## Key Files
- `cli.js` — Main entry point with smart server detection, enhanced post-setup guidance, MCP server specs, and security validation
- `cli-mcp.spec.js` — Unit tests for MCP server configurations and utilities including smart detection tests (70+ security tests)
- `cli.integration.spec.js` — End-to-end tests for scaffolding and setup flows using real subprocess execution
- `postinstall.js` — Post-installation hooks and setup verification
- **New Test Infrastructure (REQ-500-503):**
  - `../test/utils/cli-executor.ts` — Real CLI subprocess execution and monitoring
  - `../test/utils/test-environment.ts` — Environment management with proper cleanup
  - `../test/utils/e2e-types.ts` — Comprehensive TypeScript interfaces for testing

## Patterns

### MCP Server Specifications
```javascript
// Standard NPM MCP Server
{
  key: "server-name",
  title: "Display Name", 
  envVar: "API_KEY_NAME",
  helpUrl: "https://docs-url",
  command: "npx",
  args: (val) => ["-y", "@package/name", ...opts],
}

// SSE Transport MCP Server  
{
  key: "cloudflare-bindings",
  title: "Cloudflare Bindings (SSE)",
  promptType: "sse",
  sseUrl: "https://mcp-cloudflare-bindings.your-subdomain.mcp.cloudflare.com",
  transport: "sse"
}
```

### Template Processing
- Use `TEMPLATE(filename)` helper for reading template files
- Replace placeholders with actual values during scaffolding
- Maintain file permissions and directory structure

### Security Validation (REQ-502)
```javascript
// Enhanced URL validation for SSE servers with test compatibility
function validateSSEUrl(url, options = {}) {
  const { testMode = false } = options;

  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  // HTTPS only (enhanced for production)
  if (!url.startsWith('https://')) {
    throw new Error('SSE URLs must use HTTPS protocol');
  }

  // Command injection prevention - shell metacharacters
  const dangerousChars = /[;&|`$(){}[\]<>'"\\]/;
  if (dangerousChars.test(url)) {
    throw new Error('SSE URL contains potentially dangerous characters');
  }

  // Path traversal protection
  if (url.includes('../') || url.includes('..\\')) {
    throw new Error('Path traversal not allowed in SSE URLs');
  }

  // Trusted domains with comprehensive validation
  const allowedDomains = ['.mcp.cloudflare.com', 'localhost'];
  const isAllowed = allowedDomains.some(domain =>
    url.includes(domain)
  );

  if (!isAllowed && !testMode) {
    throw new Error('SSE URL must be from trusted domain (.mcp.cloudflare.com or localhost)');
  }

  return url;
}

// Command array building for injection safety (REQ-501)
function buildClaudeMcpCommand(spec) {
  if (spec.transport === 'sse') {
    return ['claude', 'mcp', 'add', spec.key, '--transport', 'sse', '--url', spec.sseUrl];
  }
  // Standard command building...
}
```

### Error Handling
```javascript
try {
  // risky operation
} catch {
  // graceful fallback without exposing internals
  return {};
}
```

## Dependencies
**Upstream:**
- Node.js built-in modules (`fs`, `path`, `child_process`)
- Claude Code CLI for MCP server management
- NPM ecosystem for MCP server packages

**Downstream:**
- `templates/` — Template files for scaffolding
- `requirements/` — REQ-ID tracking for TDD compliance
- `.claude/agents/` — Agent definitions for specialized workflows

## Common Operations

### Smart Server Detection Usage
The `checkServerStatus()` function provides intelligent server detection across all server types:
```javascript
// REQ-500: Enhanced SSE server detection (v1.0.7)
async function promptSSEServerForCommand(spec, askFn) {
  // Check server status BEFORE prompting to avoid false failures
  const serverStatus = checkServerStatus(spec.key);

  if (serverStatus.exists) {
    console.log(`✅ ${spec.title} already configured`);
    console.log(`ℹ️  Run /mcp ${spec.key} in Claude Code if authentication is needed`);
    return { action: "already_configured" };
  }
  
  // Proceed with SSE server setup...
}

// Standard server detection pattern
const serverStatus = checkServerStatus(spec.key);
if (serverStatus.exists) {
  console.log(`✅ ${spec.title} already configured`);
  console.log(`ℹ️  Run /mcp ${spec.key} in Claude Code if authentication is needed`);
} else {
  // Proceed with installation
}
```

### Already Configured Action Handling
The main configuration loop handles pre-configured servers gracefully:
```javascript
// REQ-500: Handle already configured servers (v1.0.7)
} else if (serverConfig && serverConfig.action === "already_configured") {
  // Handle already configured servers from prompt functions
  configuredServers.push(spec.title);
} else {
  // Handle other server configurations...
}
```

This pattern ensures that:
- No duplicate configuration attempts are made
- Users receive clear status feedback
- Already configured servers are tracked in the final setup summary
- False failure messages are eliminated for all server types

### Enhanced Post-Setup Experience
The `showPostSetupGuide()` provides comprehensive guidance:
- "WHAT YOU JUST GOT" section listing specific components installed
- "WHAT TO DO NEXT" section with practical examples for each MCP server
- Clear categorization of research vs. implementation tools
- Integration with qidea zero-code research workflow

### Adding New MCP Server
1. Add server spec to appropriate section in `SERVER_SPECS` array in `cli.js`
   - NPM servers: standard command/args pattern
   - SSE servers: include promptType="sse" and sseUrl
   - Path servers: include promptType="path" and executable path
2. Include required fields: title, helpUrl, and type-specific fields
3. Add corresponding test in `cli-mcp.spec.js` with REQ ID
4. Update documentation with new server capabilities and security notes
5. Update `showPostSetupGuide()` with server-specific usage examples

### Adding SSE Server Support (Production-Ready)
1. Add server spec with `promptType: "sse"` and valid `sseUrl`
2. URL must be HTTPS from trusted domain (*.mcp.cloudflare.com, localhost)
3. Test URL validation with `validateSSEUrl()` function (includes false positive testing)
4. Add integration test verifying SSE command generation
5. Update post-setup guide with SSE-specific authentication steps
6. Ensure no server key conflicts in SERVER_SPECS array
7. Validate buildSSECommand() produces correct array form (injection-safe)

### Debugging MCP Connection Issues
1. Check MCP server logs: `claude mcp list`
2. Verify package names exist on NPM (for npm servers)
3. Validate environment variables are set correctly
4. Test transport arguments (stdio vs sse)
5. For SSE servers: validate URL format and domain allowlist
6. Check Claude Code settings in `~/.claude/settings.json`
7. Verify command injection protection is not blocking legitimate URLs
8. **v1.0.7**: If seeing "❌ Failed" for existing servers, ensure `checkServerStatus()` is called before prompts
9. **v1.0.7**: Look for "already_configured" action in server configuration logs
10. **v1.0.7**: Verify SSE servers show "✅ already configured" status instead of false failures
11. **v1.0.9**: For test failures, check if using real subprocess execution vs simulation
12. **v1.0.9**: Validate TypeScript compilation if using .ts test utilities
13. **v1.0.9**: Ensure security validation functions exist and are properly exported
14. **v1.0.9**: Check for proper resource cleanup in test environments to prevent test pollution

## Template Management

### Template Synchronization Process
**Purpose**: Ensure new installations receive the latest CLAUDE.md with qidea shortcut and MCP server integration guidelines.

**Template System Overview**:
- Templates stored in `templates/` directory
- `TEMPLATE()` function loads template content during scaffolding
- `scaffoldProjectFiles()` creates files only if they don't exist (backward compatibility)

**When Templates Need Updates**:
1. After adding new QShortcuts (like qidea)
2. When updating MCP server integration guidelines
3. After significant changes to coding standards or TDD methodology
4. When adding new agent types or workflow improvements

**Sync Process (REQ-700)**:
```bash
# Copy updated root file to template
cp CLAUDE.md templates/CLAUDE.md

# Verify sync worked
grep -q "QIDEA" templates/CLAUDE.md && echo "✅ qidea shortcut synced"
grep -q "MCP Server Integration" templates/CLAUDE.md && echo "✅ MCP guidelines synced"
```

**Testing Template Deployment**:
```bash
# Test in clean directory
mkdir test-install && cd test-install

# Verify new installation gets complete content
node ../bin/cli.js --scaffold-only
grep -q "QIDEA" CLAUDE.md && echo "✅ New installs get qidea"
grep -q "MCP Server Integration" CLAUDE.md && echo "✅ New installs get MCP guidance"

# Test backward compatibility
echo "OLD CONTENT" > CLAUDE.md
node ../bin/cli.js --scaffold-only
grep -q "OLD CONTENT" CLAUDE.md && echo "✅ Existing files preserved"
```

**Maintainer Checklist**:
- [ ] Update root CLAUDE.md with new content
- [ ] Copy to templates/CLAUDE.md (REQ-700)
- [ ] Test new installation gets updated content (REQ-701)
- [ ] Verify existing projects remain unchanged (REQ-702)
- [ ] Update documentation noting the changes (REQ-703)