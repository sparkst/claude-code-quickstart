# Cloudflare SSE MCP Server Troubleshooting Guide

> **Version**: 1.0
> **Status**: Complete Testing & Validation Guide
> **Requirements**: REQ-707, REQ-705, REQ-706

## Overview

This guide provides comprehensive troubleshooting for Cloudflare SSE (Server-Sent Events) MCP servers, covering installation, configuration, authentication, and connectivity issues.

## Quick Diagnosis

### 1. Verify Command Execution Fix
The most common issue was fixed in REQ-701. Verify you have the latest version:

```bash
# Check if the execSync array bug is fixed
npm list claude-code-quickstart
```

### 2. Test Manual Installation
If the CLI fails, try manual installation:

```bash
# Cloudflare Bindings
claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse

# Cloudflare Builds
claude mcp add --scope user --transport sse cloudflare-builds https://builds.mcp.cloudflare.com/sse
```

### 3. Verify Installation
```bash
claude mcp list
```

Look for:
- `cloudflare-bindings` with transport: `sse`
- `cloudflare-builds` with transport: `sse`

## Common Issues & Solutions

### Issue 1: "Installation Failed" (Generic Error)

**Symptoms:**
```
❌ Cloudflare Bindings installation failed
❌ Cloudflare Builds installation failed
```

**Root Cause:** execSync array bug (REQ-701)

**Solution:**
1. Update to latest version with the bug fix
2. Or use manual installation commands above
3. Enable debug mode: `DEBUG_MCP=true npx claude-code-quickstart`

**Debug Output (Fixed Version):**
```
Debug: Command was: claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse
Debug: Error: claude: command not found
Debug: Exit code: 127
```

### Issue 2: "claude: command not found"

**Symptoms:**
```
Debug: Error: claude: command not found
Debug: Exit code: 127
```

**Root Cause:** Claude CLI not installed or not in PATH

**Solution:**
1. Install Claude Code: [Download from Anthropic](https://docs.anthropic.com/claude-code)
2. Verify installation: `claude --version`
3. Check PATH: `which claude`

### Issue 3: "Unknown command: mcp"

**Symptoms:**
```
Debug: Error: Unknown command: mcp
Debug: Exit code: 1
```

**Root Cause:** Outdated Claude CLI version

**Solution:**
1. Update Claude Code to latest version
2. Verify MCP support: `claude mcp --help`

### Issue 4: Authentication Required in Claude Code

**Symptoms:**
- Server appears in `claude mcp list`
- Claude Code shows authentication prompts
- `/mcp cloudflare-bindings` asks for credentials

**Root Cause:** Normal SSE authentication flow

**Solution:**
1. In Claude Code, run: `/mcp cloudflare-bindings`
2. Follow authentication prompts
3. Repeat for: `/mcp cloudflare-builds`

**Note:** `npx wrangler login` does NOT work for MCP servers

### Issue 5: Network Connectivity Issues

**Symptoms:**
```
Error: Network request failed
Error: getaddrinfo ENOTFOUND bindings.mcp.cloudflare.com
```

**Root Cause:** DNS, firewall, or proxy blocking

**Diagnostic Commands:**
```bash
# Test DNS resolution
nslookup bindings.mcp.cloudflare.com
nslookup builds.mcp.cloudflare.com

# Test HTTPS connectivity
curl -I https://bindings.mcp.cloudflare.com/sse
curl -I https://builds.mcp.cloudflare.com/sse

# Expected Response Headers:
# HTTP/2 401 (unauthenticated)
# content-type: application/json
# OR
# HTTP/2 200 (if somehow authenticated)
# content-type: text/event-stream
```

**Corporate Network Solutions:**
1. Contact IT to whitelist:
   - `*.mcp.cloudflare.com`
   - Port 443 (HTTPS)
2. Configure proxy if required
3. Test from personal network to isolate issue

### Issue 6: SSL/TLS Certificate Issues

**Symptoms:**
```
Error: certificate verify failed
Error: SSL handshake failed
```

**Solutions:**
1. Update system certificates
2. Check system time/date
3. Disable VPN temporarily to test
4. Corporate firewall may be doing SSL inspection

## Step-by-Step Validation

### 1. Environment Check
```bash
# Check Node.js version (should be 16+)
node --version

# Check Claude CLI
claude --version

# Check MCP support
claude mcp --help

# Check network connectivity
ping cloudflare.com
```

### 2. Manual Installation Test
```bash
# Install with debug
DEBUG_MCP=true claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse

# Verify
claude mcp list | grep cloudflare
```

### 3. Authentication Test
1. Open Claude Code
2. Run: `/mcp cloudflare-bindings`
3. Follow authentication flow
4. Test server functionality

### 4. Connectivity Validation
```bash
# Test endpoint accessibility
curl -v https://bindings.mcp.cloudflare.com/sse
curl -v https://builds.mcp.cloudflare.com/sse

# Should return 401 or SSE stream (if authenticated)
```

## Configuration Validation

### Verify ~/.claude/settings.json
```json
{
  "mcpServers": {
    "cloudflare-bindings": {
      "transport": "sse",
      "url": "https://bindings.mcp.cloudflare.com/sse"
    },
    "cloudflare-builds": {
      "transport": "sse",
      "url": "https://builds.mcp.cloudflare.com/sse"
    }
  }
}
```

### Security Validation
- All URLs must be HTTPS
- Only trusted Cloudflare domains allowed:
  - `bindings.mcp.cloudflare.com`
  - `builds.mcp.cloudflare.com`
  - `api.cloudflare.com`

## Recovery Procedures

### Clean Slate Recovery
```bash
# Remove existing configs
claude mcp remove cloudflare-bindings
claude mcp remove cloudflare-builds

# Reinstall manually
claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse
claude mcp add --scope user --transport sse cloudflare-builds https://builds.mcp.cloudflare.com/sse

# Verify
claude mcp list
```

### Scope Issues
```bash
# If installed in wrong scope, remove and reinstall
claude mcp remove --scope project cloudflare-bindings
claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse
```

## Advanced Debugging

### Enable Full Debug Mode
```bash
export DEBUG_MCP=true
export NODE_DEBUG=*
npx claude-code-quickstart init
```

### Network Debugging
```bash
# Test with curl verbose mode
curl -v -H "Accept: text/event-stream" https://bindings.mcp.cloudflare.com/sse

# Check SSL certificate
openssl s_client -connect bindings.mcp.cloudflare.com:443 -servername bindings.mcp.cloudflare.com
```

### File System Debugging
```bash
# Check permissions
ls -la ~/.claude/
cat ~/.claude/settings.json

# Check for corruption
jq . ~/.claude/settings.json
```

## Working Examples

### Successful Installation Log
```
Installing Cloudflare Bindings...
✅ Cloudflare Bindings configured successfully
ℹ️  Run /mcp cloudflare-bindings in Claude Code if authentication is needed

Installing Cloudflare Builds...
✅ Cloudflare Builds configured successfully
ℹ️  Run /mcp cloudflare-builds in Claude Code if authentication is needed
```

### Successful Authentication in Claude Code
1. Run `/mcp cloudflare-bindings`
2. See OAuth-style authentication prompt
3. Complete browser-based auth flow
4. Return to Claude Code
5. See "✅ Connected to Cloudflare Bindings"

## Support & Escalation

### Self-Service Diagnostics
1. Run all validation steps above
2. Check [Cloudflare Status](https://www.cloudflarestatus.com)
3. Test from different network
4. Try different authentication method

### When to Escalate
- All manual commands fail
- Network connectivity confirmed working
- Claude CLI updated and functional
- Corporate environment with restrictions

### Information to Provide
```bash
# System info
uname -a
node --version
claude --version

# Network test results
curl -I https://bindings.mcp.cloudflare.com/sse

# Configuration
cat ~/.claude/settings.json | jq '.mcpServers | keys'

# Debug output
DEBUG_MCP=true claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse
```

## Preventive Measures

### Regular Health Checks
```bash
# Weekly validation
claude mcp list | grep cloudflare
curl -I https://bindings.mcp.cloudflare.com/sse
```

### Keep Updated
- Monitor Claude Code updates
- Update claude-code-quickstart regularly
- Watch for Cloudflare API changes

### Environment Stability
- Document working configuration
- Backup `~/.claude/settings.json`
- Document corporate network requirements

## Related Documentation

- [Claude Code MCP Guide](https://docs.anthropic.com/claude-code/mcp)
- [Cloudflare Workers Bindings](https://developers.cloudflare.com/workers/configuration/bindings/)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/builds/)
- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)