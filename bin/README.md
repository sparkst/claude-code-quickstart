# CLI Implementation

## Purpose
Main CLI implementation that orchestrates MCP server configuration, project scaffolding, and Claude Code setup. Handles interactive prompts, template processing, and environment validation.

## Boundaries
**In Scope:**
- MCP server discovery and configuration
- Interactive user prompts for API keys and settings
- Template processing and file scaffolding
- Environment validation and error handling
- Agent registration with Claude Code

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
{
  key: "server-name",
  title: "Display Name", 
  envVar: "API_KEY_NAME",
  helpUrl: "https://docs-url",
  command: "npx",
  args: (val) => ["-y", "@package/name", ...opts],
}
```

### Template Processing
- Use `TEMPLATE(filename)` helper for reading template files
- Replace placeholders with actual values during scaffolding
- Maintain file permissions and directory structure

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
1. Add server spec to `SERVER_SPECS` array in `cli.js`
2. Include package name, environment variables, help URL
3. Add corresponding test in `cli-mcp.spec.js`
4. Update documentation with new server capabilities

### Debugging MCP Connection Issues
1. Check MCP server logs: `claude mcp list`
2. Verify package names exist on NPM
3. Validate environment variables are set
4. Test transport arguments (stdio vs http)
5. Check Claude Code settings in `~/.claude/settings.json`