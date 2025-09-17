#!/usr/bin/env node
/**
 * REQ-705, REQ-706: Manual SSE Server Validation Script
 * Comprehensive validation of Cloudflare SSE MCP server configuration
 */

const { execSync } = require("node:child_process");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Import CLI module for validation functions
const cliPath = path.join(__dirname, "../../bin/cli.js");
const { validateSSEUrl, buildSSECommand, SERVER_SPECS } = require(cliPath);

class SSEValidator {
  constructor() {
    this.results = {
      environment: {},
      connectivity: {},
      configuration: {},
      authentication: {},
      errors: []
    };
  }

  log(category, test, status, details = null) {
    const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️";
    console.log(`${icon} [${category}] ${test}${details ? `: ${details}` : ""}`);

    if (!this.results[category]) {
      this.results[category] = {};
    }
    this.results[category][test] = { status, details };
  }

  error(message, error = null) {
    console.error(`❌ ERROR: ${message}`);
    if (error) {
      console.error(`   Details: ${error.message}`);
    }
    this.results.errors.push({ message, error: error?.message });
  }

  // REQ-705: Environment validation
  async validateEnvironment() {
    console.log("\n🔍 Environment Validation");
    console.log("=".repeat(50));

    // Check Node.js version
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      this.log("environment", "Node.js version",
        majorVersion >= 16 ? "pass" : "fail",
        `${nodeVersion} (require 16+)`);
    } catch (error) {
      this.error("Failed to check Node.js version", error);
    }

    // Check Claude CLI availability
    try {
      const claudeVersion = execSync("claude --version", {
        encoding: "utf8",
        stdio: "pipe"
      }).trim();
      this.log("environment", "Claude CLI available", "pass", claudeVersion);
    } catch (error) {
      this.log("environment", "Claude CLI available", "fail",
        error.code === "ENOENT" ? "Command not found" : error.message);
    }

    // Check MCP subcommand
    try {
      execSync("claude mcp --help", { stdio: "pipe" });
      this.log("environment", "MCP subcommand available", "pass");
    } catch (error) {
      this.log("environment", "MCP subcommand available", "fail",
        "Run 'claude mcp --help' to verify");
    }

    // Check ~/.claude directory
    const claudeDir = path.join(os.homedir(), ".claude");
    if (fs.existsSync(claudeDir)) {
      this.log("environment", "Claude config directory", "pass", claudeDir);
    } else {
      this.log("environment", "Claude config directory", "fail", "Missing ~/.claude");
    }
  }

  // REQ-705: Network connectivity validation
  async validateConnectivity() {
    console.log("\n🌐 Network Connectivity");
    console.log("=".repeat(50));

    const sseServers = SERVER_SPECS.filter(s => s.transport === "sse");

    for (const spec of sseServers) {
      try {
        const url = new URL(spec.url);

        await this.testHttpsConnectivity(url.hostname, spec.title);
        await this.testSSEEndpoint(spec.url, spec.title);
      } catch (error) {
        this.error(`Failed to test ${spec.title}`, error);
      }
    }
  }

  testHttpsConnectivity(hostname, title) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname,
        port: 443,
        path: "/",
        method: "HEAD",
        timeout: 5000
      }, (res) => {
        this.log("connectivity", `${title} HTTPS`, "pass",
          `${res.statusCode} ${res.statusMessage}`);
        resolve();
      });

      req.on("error", (error) => {
        this.log("connectivity", `${title} HTTPS`, "fail", error.message);
        reject(error);
      });

      req.on("timeout", () => {
        this.log("connectivity", `${title} HTTPS`, "fail", "Timeout");
        req.destroy();
        reject(new Error("Timeout"));
      });

      req.end();
    });
  }

  testSSEEndpoint(url, title) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);

      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: "GET",
        headers: {
          "Accept": "text/event-stream",
          "Cache-Control": "no-cache"
        },
        timeout: 5000
      }, (res) => {
        const expectedStatuses = [200, 401, 403]; // 200=authenticated, 401=needs auth, 403=forbidden
        const status = expectedStatuses.includes(res.statusCode) ? "pass" : "warn";
        this.log("connectivity", `${title} SSE endpoint`, status,
          `${res.statusCode} ${res.statusMessage}`);

        if (res.headers["content-type"]?.includes("text/event-stream")) {
          this.log("connectivity", `${title} SSE headers`, "pass", "text/event-stream");
        } else if (res.statusCode === 401) {
          this.log("connectivity", `${title} SSE headers`, "pass", "Authentication required");
        } else {
          this.log("connectivity", `${title} SSE headers`, "warn",
            res.headers["content-type"] || "Unknown content-type");
        }

        resolve();
      });

      req.on("error", (error) => {
        this.log("connectivity", `${title} SSE endpoint`, "fail", error.message);
        reject(error);
      });

      req.on("timeout", () => {
        this.log("connectivity", `${title} SSE endpoint`, "fail", "Timeout");
        req.destroy();
        reject(new Error("Timeout"));
      });

      req.end();
    });
  }

  // REQ-703, REQ-706: Configuration validation
  validateConfiguration() {
    console.log("\n⚙️  Configuration Validation");
    console.log("=".repeat(50));

    const sseServers = SERVER_SPECS.filter(s => s.transport === "sse");

    // Test URL validation
    for (const spec of sseServers) {
      try {
        const validatedUrl = validateSSEUrl(spec.url);
        this.log("configuration", `${spec.title} URL validation`, "pass", validatedUrl);
      } catch (error) {
        this.log("configuration", `${spec.title} URL validation`, "fail", error.message);
      }
    }

    // Test command building
    for (const spec of sseServers) {
      try {
        const command = buildSSECommand(spec, "user");
        const commandString = command.join(" ");

        if (commandString.includes("--transport sse") && commandString.includes(spec.url)) {
          this.log("configuration", `${spec.title} command build`, "pass", commandString);
        } else {
          this.log("configuration", `${spec.title} command build`, "fail",
            "Missing required parameters");
        }
      } catch (error) {
        this.log("configuration", `${spec.title} command build`, "fail", error.message);
      }
    }

    // Test server specifications
    this.validateServerSpecs();
  }

  validateServerSpecs() {
    const sseServers = SERVER_SPECS.filter(s => s.transport === "sse");

    if (sseServers.length === 0) {
      this.log("configuration", "SSE servers defined", "fail", "No SSE servers found");
      return;
    }

    this.log("configuration", "SSE servers defined", "pass",
      `${sseServers.length} servers: ${sseServers.map(s => s.key).join(", ")}`);

    // Validate Cloudflare servers specifically
    const cloudflareServers = sseServers.filter(s => s.key.startsWith("cloudflare"));
    const expectedServers = ["cloudflare-bindings", "cloudflare-builds"];

    for (const expectedKey of expectedServers) {
      const server = cloudflareServers.find(s => s.key === expectedKey);
      if (server) {
        this.log("configuration", `${expectedKey} server spec`, "pass",
          `${server.title} -> ${server.url}`);
      } else {
        this.log("configuration", `${expectedKey} server spec`, "fail", "Missing");
      }
    }
  }

  // REQ-706: Authentication flow validation
  validateAuthentication() {
    console.log("\n🔐 Authentication Validation");
    console.log("=".repeat(50));

    // Check existing MCP configuration
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

    if (!fs.existsSync(settingsPath)) {
      this.log("authentication", "Claude settings file", "warn",
        "~/.claude/settings.json not found");
      return;
    }

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      const mcpServers = settings.mcpServers || {};

      this.log("authentication", "Claude settings file", "pass", settingsPath);

      // Check for Cloudflare servers
      const sseServers = SERVER_SPECS.filter(s => s.transport === "sse");

      for (const spec of sseServers) {
        const serverConfig = mcpServers[spec.key];

        if (serverConfig) {
          if (serverConfig.transport === "sse" && serverConfig.url === spec.url) {
            this.log("authentication", `${spec.title} configured`, "pass",
              "Correct SSE configuration");
          } else {
            this.log("authentication", `${spec.title} configured`, "warn",
              "Configuration mismatch");
          }
        } else {
          this.log("authentication", `${spec.title} configured`, "fail",
            "Not configured - run installation");
        }
      }

    } catch (error) {
      this.log("authentication", "Claude settings file", "fail",
        "Invalid JSON or read error");
    }
  }

  // Generate troubleshooting commands
  generateTroubleshootingCommands() {
    console.log("\n🛠️  Troubleshooting Commands");
    console.log("=".repeat(50));

    const sseServers = SERVER_SPECS.filter(s => s.transport === "sse");

    console.log("\n🔧 Manual Installation Commands:");
    for (const spec of sseServers) {
      const command = buildSSECommand(spec, "user").join(" ");
      console.log(`   ${command}`);
    }

    console.log("\n🔍 Diagnostic Commands:");
    console.log("   claude --version");
    console.log("   claude mcp list");
    console.log("   curl -I https://bindings.mcp.cloudflare.com/sse");
    console.log("   curl -I https://builds.mcp.cloudflare.com/sse");

    console.log("\n🧹 Clean Installation Commands:");
    for (const spec of sseServers) {
      console.log(`   claude mcp remove ${spec.key}`);
    }

    console.log("\n🔐 Authentication Commands (in Claude Code):");
    for (const spec of sseServers) {
      console.log(`   /mcp ${spec.key}`);
    }
  }

  // Generate summary report
  generateSummary() {
    console.log("\n📊 Validation Summary");
    console.log("=".repeat(50));

    const categories = ["environment", "connectivity", "configuration", "authentication"];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let warnTests = 0;

    for (const category of categories) {
      const tests = this.results[category] || {};
      const categoryTests = Object.keys(tests).length;
      const passed = Object.values(tests).filter(t => t.status === "pass").length;
      const failed = Object.values(tests).filter(t => t.status === "fail").length;
      const warned = Object.values(tests).filter(t => t.status === "warn").length;

      totalTests += categoryTests;
      passedTests += passed;
      failedTests += failed;
      warnTests += warned;

      console.log(`${category.toUpperCase()}: ${passed}✅ ${failed}❌ ${warned}⚠️  (${categoryTests} total)`);
    }

    console.log("-".repeat(30));
    console.log(`TOTAL: ${passedTests}✅ ${failedTests}❌ ${warnTests}⚠️  (${totalTests} tests)`);

    if (this.results.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.results.errors.length}):`);
      this.results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.message}`);
        if (error.error) {
          console.log(`      ${error.error}`);
        }
      });
    }

    // Overall status
    if (failedTests === 0 && this.results.errors.length === 0) {
      console.log("\n🎉 All critical tests passed! SSE configuration is ready.");
    } else if (failedTests > 0) {
      console.log("\n⚠️  Some tests failed. Review issues above and run manual installation if needed.");
    } else {
      console.log("\n✅ Configuration looks good with minor warnings.");
    }
  }

  // Main validation runner
  async run() {
    console.log("🔍 Cloudflare SSE MCP Server Validation");
    console.log("=" .repeat(60));
    console.log("Comprehensive testing of SSE configuration and connectivity\n");

    try {
      await this.validateEnvironment();
      await this.validateConnectivity();
      this.validateConfiguration();
      this.validateAuthentication();
      this.generateTroubleshootingCommands();
      this.generateSummary();
    } catch (error) {
      this.error("Validation failed", error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const validator = new SSEValidator();
  validator.run().catch(error => {
    console.error("❌ Validation script failed:", error.message);
    process.exit(1);
  });
}

module.exports = { SSEValidator };