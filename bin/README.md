# CLI Implementation

## Purpose
Main CLI implementation that orchestrates MCP server configuration, project scaffolding, and Claude Code setup. Handles interactive prompts, template processing, and environment validation.

## Boundaries
**In Scope:**
- MCP server discovery and configuration (stdio, SSE transport)
- Interactive user prompts for API keys and settings
- Template processing and file scaffolding
- Environment validation and security enforcement
- Agent registration with Claude Code
- SSE URL validation and command injection prevention

**Out of Scope:**
- Actual MCP server implementations (delegates to external packages)
- Claude Code runtime behavior (only configures)
- Network operations beyond basic validation

## Key Files
- `cli.js` — Main entry point with command routing and MCP server specs
- `cli-mcp.spec.js` — Unit tests for MCP server configurations and utilities
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

### Adding New MCP Server
1. Add server spec to appropriate section in `SERVER_SPECS` array in `cli.js`
   - NPM servers: standard command/args pattern
   - SSE servers: include promptType="sse" and sseUrl
   - Path servers: include promptType="path" and executable path
2. Include required fields: title, helpUrl, and type-specific fields
3. Add corresponding test in `cli-mcp.spec.js` with REQ ID
4. Update documentation with new server capabilities and security notes

### Adding SSE Server Support
1. Add server spec with `promptType: "sse"` and valid `sseUrl`
2. URL must be HTTPS from trusted domain (*.mcp.cloudflare.com, localhost)
3. Test URL validation with `validateSSEUrl()` function
4. Add integration test verifying SSE command generation
5. Update post-setup guide with SSE-specific authentication steps

### Debugging MCP Connection Issues
1. Check MCP server logs: `claude mcp list`
2. Verify package names exist on NPM (for npm servers)
3. Validate environment variables are set correctly
4. Test transport arguments (stdio vs sse)
5. For SSE servers: validate URL format and domain allowlist
6. Check Claude Code settings in `~/.claude/settings.json`
7. Verify command injection protection is not blocking legitimate URLs