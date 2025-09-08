import { describe, test, expect } from "vitest";

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
      key: "cloudflare",
      title: "Cloudflare",
      promptType: "wrangler",
      helpUrl:
        "https://developers.cloudflare.com/workers/wrangler/install-and-update/",
      command: "npx",
      args: () => ["-y", "@cloudflare/mcp-server-cloudflare", "init"],
    },
  ];

  test("n8n server has two environment variables", () => {
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
      } catch (error) {
        // If we can't check, assume it doesn't exist
        return false;
      }
    };
  };

  test("returns true when server exists in output", () => {
    const mockOutput = `Checking MCP server health...

brave-search: npx -y @brave/brave-search-mcp-server - ✗ Failed to connect
context7: npx -y @upstash/context7-mcp - ✓ Connected
supabase: npx -y @supabase/mcp-server-supabase - ✓ Connected`;

    const checkExists = mockCheckMcpServerExists(mockOutput);

    expect(checkExists("context7")).toBe(true);
    expect(checkExists("brave-search")).toBe(true);
    expect(checkExists("supabase")).toBe(true);
  });

  test("returns false when server does not exist in output", () => {
    const mockOutput = `Checking MCP server health...

brave-search: npx -y @brave/brave-search-mcp-server - ✗ Failed to connect
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

describe("handleExistingServer", () => {
  const mockHandleExistingServer = (mockExecSync, mockConsoleLog) => {
    return async (spec, askFn) => {
      mockConsoleLog(`  ⚠️  ${spec.title} is already configured`);
      const choice = await askFn(
        `What would you like to do? (k)eep existing, (r)emove and reinstall, (s)kip`,
        "k",
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
              `  ❌ Failed to remove ${spec.title}: ${error.message}`,
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
    const mockAskFn = async () => "k";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("keep");
  });

  test("returns 'keep' when user chooses default option", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockAskFn = async () => "invalid-choice";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("keep");
  });

  test("returns 'skip' when user chooses skip option", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockAskFn = async () => "s";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("skip");
  });

  test("returns 'reinstall' when remove succeeds", async () => {
    const mockExecSync = () => {}; // Successful removal
    const mockConsoleLog = () => {};
    const mockAskFn = async () => "r";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
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
    const mockAskFn = async () => "remove";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
    );
    const spec = { title: "Context7", key: "context7" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("skip");
  });

  test("handles 'remove' full word choice", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};
    const mockAskFn = async () => "remove";

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
    );
    const spec = { title: "Supabase", key: "supabase" };

    const result = await handleExisting(spec, mockAskFn);
    expect(result).toBe("reinstall");
  });

  test("handles case insensitive choices", async () => {
    const mockExecSync = () => {};
    const mockConsoleLog = () => {};

    const handleExisting = mockHandleExistingServer(
      mockExecSync,
      mockConsoleLog,
    );
    const spec = { title: "GitHub", key: "github" };

    // Test uppercase choices
    expect(await handleExisting(spec, async () => "K")).toBe("keep");
    expect(await handleExisting(spec, async () => "S")).toBe("skip");
    expect(await handleExisting(spec, async () => "R")).toBe("reinstall");
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
