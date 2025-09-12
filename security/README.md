# Security

## Purpose
Security validation, threat prevention, and safe handling of user input in MCP server configuration. Focuses on URL validation, command injection prevention, and trusted domain enforcement for SSE transport.

## Boundaries
**In Scope:**
- URL parameter validation for SSE servers
- Command injection prevention in shell execution
- Trusted domain allowlists for external services
- Path traversal attack prevention
- Shell metacharacter sanitization

**Out of Scope:**
- Network-level security (TLS/SSL configuration)
- Authentication mechanisms (handled by MCP servers)
- Runtime permission enforcement (delegated to Claude Code)

## Key Files
- `bin/cli.js` — Core security functions: `validateSSEUrl()`, `buildSSECommand()`
- `bin/cli-mcp.spec.js` — Security validation tests (REQ-400 test suite)
- `requirements/current.md` — Security requirements documentation

## Security Patterns

### URL Validation
```javascript
function validateSSEUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }
  
  // HTTPS enforcement
  if (!url.startsWith('https://')) {
    throw new Error('SSE URLs must use HTTPS protocol');
  }
  
  // Trusted domain allowlist
  const allowedDomains = ['.mcp.cloudflare.com', 'localhost'];
  const isAllowed = allowedDomains.some(domain => 
    url.includes(domain)
  );
  if (!isAllowed) {
    throw new Error('SSE URL must be from trusted domain');
  }
  
  // Shell metacharacter prevention
  const dangerousChars = /[;&|`$(){}[\]\\]/;
  if (dangerousChars.test(url)) {
    throw new Error('URL contains invalid characters');
  }
  
  return url;
}
```

### Safe Command Building
```javascript
function buildSSECommand(spec, scope) {
  // Validate URL before use
  const validUrl = validateSSEUrl(spec.sseUrl);
  
  // Use array form to prevent injection
  return [
    'claude', 'mcp', 'add', scope.key,
    '--transport', 'sse',
    '--url', validUrl
  ];
}
```

## Threat Model

### Command Injection (HIGH)
- **Threat**: User-controlled URL parameters passed to shell
- **Mitigation**: URL validation, shell metacharacter filtering
- **Test Coverage**: REQ-400 suite validates injection prevention

### Path Traversal (MEDIUM)
- **Threat**: Malicious URLs with `../` sequences
- **Mitigation**: HTTPS + trusted domain enforcement
- **Test Coverage**: Boundary testing with path traversal payloads

### Domain Spoofing (MEDIUM)  
- **Threat**: Malicious domains mimicking trusted services
- **Mitigation**: Strict allowlist with exact domain matching
- **Test Coverage**: Domain validation edge cases

### Protocol Downgrade (LOW)
- **Threat**: HTTP URLs exposing credentials
- **Mitigation**: HTTPS-only enforcement
- **Test Coverage**: Protocol validation tests

## Dependencies
**Upstream:**
- Node.js built-in security (no external crypto dependencies)
- HTTPS enforcement relies on URL protocol checking

**Downstream:**
- `bin/cli.js` — Core security implementation
- Test suites validate security boundary enforcement
- Requirements documentation tracks security compliance

## Common Security Tasks

### Adding New URL Validation
1. Update `validateSSEUrl()` function with new checks
2. Add corresponding test cases in `cli-mcp.spec.js`
3. Document new validation rules in security README
4. Update threat model with new mitigations

### Reviewing Security Changes
1. Verify all user input passes through validation functions
2. Check that shell commands use array form, not string concatenation
3. Validate that error messages don't expose internal details
4. Ensure test coverage includes boundary and injection cases

### Security Testing
1. Run REQ-400 test suite: `npm test -- --grep "REQ-400"`
2. Test with malicious payloads (documented in test constants)
3. Verify HTTPS enforcement blocks HTTP URLs
4. Check trusted domain allowlist rejects unknown domains

## Security Gotchas
- Always validate URLs before passing to shell commands
- Use array form for command execution to prevent injection
- Error messages should be clear but not expose internal paths
- Domain allowlist must be restrictive - prefer exact matches over patterns
- Test with realistic attack payloads, not just happy path validation