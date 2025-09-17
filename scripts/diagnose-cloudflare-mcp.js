#!/usr/bin/env node
/**
 * Cloudflare MCP Server Installation Diagnostics
 *
 * This script helps debug why Cloudflare MCP servers fail to install.
 * Run with: node scripts/diagnose-cloudflare-mcp.js
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

console.log('🔍 Cloudflare MCP Server Installation Diagnostics');
console.log('================================================\n');

// Check if we're in the right directory
const binCliPath = path.join(__dirname, '..', 'bin', 'cli.js');
if (!fs.existsSync(binCliPath)) {
  console.error('❌ Error: Run this script from the claude-code-quickstart root directory');
  process.exit(1);
}

// Import the CLI functions
let SERVER_SPECS, buildSSECommand, buildClaudeMcpCommand;
try {
  const cliModule = require('../bin/cli.js');
  SERVER_SPECS = cliModule.SERVER_SPECS;
  buildSSECommand = cliModule.buildSSECommand;
  buildClaudeMcpCommand = cliModule.buildClaudeMcpCommand;
} catch (error) {
  console.error('❌ Error loading CLI module:', error.message);
  process.exit(1);
}

function runCommand(cmd, options = {}) {
  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.status,
      stderr: error.stderr?.toString(),
      stdout: error.stdout?.toString()
    };
  }
}

console.log('1️⃣ Environment Check');
console.log('--------------------');

// Node.js version
console.log(`Node.js version: ${process.version}`);

// Claude CLI availability
const claudeCheck = runCommand('claude --version', { silent: true });
if (claudeCheck.success) {
  console.log(`✅ Claude CLI: ${claudeCheck.output.trim()}`);
} else {
  console.log(`❌ Claude CLI: Not found or not working`);
  console.log(`   Error: ${claudeCheck.error}`);
}

// MCP command availability
const mcpCheck = runCommand('claude mcp --help', { silent: true });
if (mcpCheck.success) {
  console.log(`✅ Claude MCP: Available`);
} else {
  console.log(`❌ Claude MCP: Not available`);
  console.log(`   Error: ${mcpCheck.error}`);
}

// Claude directory
const claudeDir = path.join(os.homedir(), '.claude');
if (fs.existsSync(claudeDir)) {
  console.log(`✅ Claude directory: ${claudeDir}`);

  // Settings file
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const mcpServers = settings.mcpServers || {};
      const serverCount = Object.keys(mcpServers).length;
      console.log(`✅ Settings file: ${serverCount} MCP servers configured`);

      // Check for Cloudflare servers
      const cloudflareServers = Object.keys(mcpServers).filter(key =>
        key.includes('cloudflare')
      );
      if (cloudflareServers.length > 0) {
        console.log(`   Cloudflare servers: ${cloudflareServers.join(', ')}`);
      }
    } catch (error) {
      console.log(`⚠️  Settings file: Exists but invalid JSON`);
    }
  } else {
    console.log(`⚠️  Settings file: Not found`);
  }
} else {
  console.log(`❌ Claude directory: Not found at ${claudeDir}`);
}

console.log('\n2️⃣ Command Building Test (REQ-701)');
console.log('----------------------------------');

// Test SSE command building
const cloudflareSpecs = SERVER_SPECS.filter(spec =>
  spec.transport === 'sse' && spec.key.startsWith('cloudflare')
);

for (const spec of cloudflareSpecs) {
  console.log(`\nTesting ${spec.title}:`);
  console.log(`  Key: ${spec.key}`);
  console.log(`  URL: ${spec.url}`);

  try {
    // Test buildSSECommand
    const sseCommand = buildSSECommand(spec, 'user');
    console.log(`  ✅ buildSSECommand returns: ${typeof sseCommand}`);
    console.log(`     Array content: [${sseCommand.join(', ')}]`);

    // Test buildClaudeMcpCommand
    const fullCommand = buildClaudeMcpCommand(spec, 'user', {});
    console.log(`  ✅ buildClaudeMcpCommand returns: ${typeof fullCommand}`);
    console.log(`     Array content: [${fullCommand.join(', ')}]`);

    // Test execSync with array vs string
    console.log(`  🧪 Testing execSync behavior:`);
    const commandString = fullCommand.join(' ');
    console.log(`     Command string: ${commandString}`);

    // This would fail with the array:
    console.log(`  ❌ CRITICAL BUG: execSync receives array but expects string!`);
    console.log(`     Array: ${JSON.stringify(fullCommand)}`);
    console.log(`     String: "${commandString}"`);

  } catch (error) {
    console.log(`  ❌ Command building failed: ${error.message}`);
  }
}

console.log('\n3️⃣ Manual Installation Test');
console.log('-----------------------------');

for (const spec of cloudflareSpecs) {
  console.log(`\nTesting manual installation: ${spec.title}`);

  const manualCommand = `claude mcp add --scope user --transport sse ${spec.key} ${spec.url}`;
  console.log(`  Command: ${manualCommand}`);

  const result = runCommand(manualCommand, { silent: true });
  if (result.success) {
    console.log(`  ✅ Manual installation: SUCCESS`);
  } else {
    console.log(`  ❌ Manual installation: FAILED`);
    console.log(`     Error: ${result.error}`);
    if (result.stderr) {
      console.log(`     Stderr: ${result.stderr}`);
    }
  }
}

console.log('\n4️⃣ Network Connectivity Test');
console.log('------------------------------');

const sseUrls = cloudflareSpecs.map(spec => spec.url);
for (const url of sseUrls) {
  console.log(`\nTesting connectivity to: ${url}`);

  const curlResult = runCommand(`curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}"`, { silent: true });
  if (curlResult.success) {
    const statusCode = curlResult.output.trim();
    if (statusCode.startsWith('2') || statusCode.startsWith('3')) {
      console.log(`  ✅ HTTP ${statusCode}: Accessible`);
    } else {
      console.log(`  ⚠️  HTTP ${statusCode}: Unexpected response`);
    }
  } else {
    console.log(`  ❌ Connection failed: ${curlResult.error}`);
  }
}

console.log('\n5️⃣ Current MCP Server Status');
console.log('-----------------------------');

const listResult = runCommand('claude mcp list', { silent: true });
if (listResult.success) {
  console.log('✅ Current MCP servers:');
  console.log(listResult.output);
} else {
  console.log('❌ Failed to list MCP servers:');
  console.log(`   Error: ${listResult.error}`);
}

console.log('\n📋 Diagnosis Summary');
console.log('===================');

console.log('\n🔴 CRITICAL BUG IDENTIFIED (REQ-701):');
console.log('  • buildClaudeMcpCommand() returns an array');
console.log('  • execSync() expects a string command');
console.log('  • This causes TypeError and installation failure');
console.log('  • Fix: Join array with spaces before passing to execSync');

console.log('\n🛠️  IMMEDIATE FIX:');
console.log('  In bin/cli.js line 677, change:');
console.log('    execSync(command, { stdio: "inherit" });');
console.log('  To:');
console.log('    execSync(Array.isArray(command) ? command.join(" ") : command, { stdio: "inherit" });');

console.log('\n🔧 MANUAL INSTALLATION COMMANDS:');
for (const spec of cloudflareSpecs) {
  console.log(`  claude mcp add --scope user --transport sse ${spec.key} ${spec.url}`);
}

console.log('\n🔍 VERIFICATION:');
console.log('  After installation, run: claude mcp list');
console.log('  In Claude Code, authenticate with: /mcp cloudflare-bindings');
console.log('  In Claude Code, authenticate with: /mcp cloudflare-builds');

console.log('\n✅ Diagnostics complete! See summary above for next steps.');