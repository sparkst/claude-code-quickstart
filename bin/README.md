# CLI Implementation

## Purpose
Production-ready CLI implementation that orchestrates MCP server configuration, project scaffolding, and Claude Code setup. Features smart server detection to avoid false failure messages, enhanced post-setup experience with specific component listings, and comprehensive MCP integration guidelines for zero-code research workflows.

## Boundaries
**In Scope:**
- Smart MCP server detection with `checkServerStatus()` to avoid false failure messages during setup
- Enhanced post-setup experience with `showPostSetupGuide()` providing specific component listings and practical examples
- Interactive user prompts for API keys and settings with masked re-entry support
- Template processing and file scaffolding with TDD methodology and comprehensive MCP integration guidelines
- Advanced environment validation and security enforcement
- Agent registration with Claude Code including zero-code research workflow (qidea)
- Comprehensive SSE URL validation and command injection prevention
- Server conflict resolution (fixed "MCP server cloudflare already exists" errors)
- URL validation false positive fixes for legitimate https:// URLs

**Out of Scope:**
- Actual MCP server implementations (delegates to external packages)
- Claude Code runtime behavior (only configures)
- Network operations beyond basic validation

## Key Files
- `cli.js` — Main entry point with smart server detection, enhanced post-setup guidance, and MCP server specs
- `cli-mcp.spec.js` — Unit tests for MCP server configurations and utilities including smart detection tests
- `cli.integration.spec.js` — End-to-end tests for scaffolding and setup flows
- `postinstall.js` — Post-installation hooks and setup verification

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

### Security Validation
```javascript
// URL validation for SSE servers
function validateSSEUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }
  
  // HTTPS only
  if (!url.startsWith('https://')) {
    throw new Error('SSE URLs must use HTTPS protocol');
  }
  
  // Trusted domains only
  const allowedDomains = ['.mcp.cloudflare.com', 'localhost'];
  const isAllowed = allowedDomains.some(domain => 
    url.includes(domain)
  );
  if (!isAllowed) {
    throw new Error('SSE URL must be from trusted domain');
  }
  
  return url;
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
The `checkServerStatus()` function provides intelligent server detection:
```javascript
const serverStatus = checkServerStatus(spec.key);
if (serverStatus.exists) {
  console.log(`✅ ${spec.title} already configured`);
  console.log(`ℹ️  Run /mcp ${spec.key} in Claude Code if authentication is needed`);
} else {
  // Proceed with installation
}
```

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