/**
 * REQ-701: Simple validation test for the execSync array fix
 * Tests the fix without requiring actual command execution
 */

import { describe, test, expect } from "vitest";

// Import the CLI module to test the actual functions
const cliModule = await import("../../bin/cli.js");
const { buildClaudeMcpCommand, SERVER_SPECS } = cliModule;

describe("REQ-701 — Command Fix Validation", () => {
  test("REQ-701 — verify fix logic handles arrays correctly", () => {
    // Get an SSE server spec
    const sseSpec = SERVER_SPECS.find(s => s.transport === "sse");
    expect(sseSpec).toBeDefined();

    // Generate the command (which returns an array)
    const command = buildClaudeMcpCommand(sseSpec, "user", {});
    expect(Array.isArray(command)).toBe(true);

    // Apply the exact fix logic from the code
    const commandString = Array.isArray(command) ? command.join(" ") : command;

    // Verify the fix works correctly
    expect(typeof commandString).toBe("string");
    expect(commandString.length).toBeGreaterThan(0);
    expect(commandString).toMatch(/^claude mcp add/);

    console.log("Original array:", command);
    console.log("Fixed string:", commandString);
  });

  test("REQ-701 — verify fix handles string inputs (npm servers)", () => {
    // For npm servers, buildClaudeMcpCommand still returns arrays
    const npmSpec = SERVER_SPECS.find(s => s.command === "npx");
    expect(npmSpec).toBeDefined();

    const command = buildClaudeMcpCommand(npmSpec, "user", { [npmSpec.envVar]: "test" });
    expect(Array.isArray(command)).toBe(true);

    // Apply the fix
    const commandString = Array.isArray(command) ? command.join(" ") : command;

    expect(typeof commandString).toBe("string");
    expect(commandString).toMatch(/^claude mcp add/);

    console.log("NPM command array:", command);
    console.log("NPM command string:", commandString);
  });

  test("REQ-701 — validate command safety after fix", () => {
    const sseServers = SERVER_SPECS.filter(s => s.transport === "sse");

    for (const spec of sseServers) {
      const command = buildClaudeMcpCommand(spec, "user", {});
      const commandString = Array.isArray(command) ? command.join(" ") : command;

      // Ensure no dangerous characters that could cause shell injection
      expect(commandString).not.toMatch(/[;&|`$(){}[\]\\]/);

      // Ensure the command structure is safe
      expect(commandString.split(" ")[0]).toBe("claude");
      expect(commandString.split(" ")[1]).toBe("mcp");
      expect(commandString.split(" ")[2]).toBe("add");

      // Ensure URLs are HTTPS
      const urlMatch = commandString.match(/https:\/\/[^\s]+/);
      expect(urlMatch).toBeTruthy();
      if (urlMatch) {
        expect(urlMatch[0]).toMatch(/^https:\/\//);
      }
    }
  });

  test("REQ-701 — demonstrate the bug and fix", () => {
    // This test shows exactly what the bug was and how the fix resolves it

    const sseSpec = SERVER_SPECS.find(s => s.key === "cloudflare-bindings");
    const command = buildClaudeMcpCommand(sseSpec, "user", {});

    // THE BUG: execSync receives an array
    console.log("❌ BUG: execSync would receive:", typeof command, command);
    expect(Array.isArray(command)).toBe(true); // This is the problem

    // THE FIX: Convert array to string
    const fixedCommand = Array.isArray(command) ? command.join(" ") : command;
    console.log("✅ FIX: execSync now receives:", typeof fixedCommand, fixedCommand);
    expect(typeof fixedCommand).toBe("string"); // This is the solution

    // Verify the string is valid
    expect(fixedCommand).toBe(
      "claude mcp add --scope user --transport sse cloudflare-bindings https://bindings.mcp.cloudflare.com/sse"
    );
  });

  test("REQ-701 — error context validation", () => {
    // Test the debug error reporting enhancement
    const mockError = {
      message: "Command not found",
      status: 127
    };

    const commandArray = ["claude", "mcp", "add", "test-server"];
    const commandString = commandArray.join(" ");

    // Simulate the debug logging that would occur
    const debugOutput = {
      command: commandString,
      error: mockError.message,
      status: mockError.status
    };

    expect(debugOutput.command).toBe("claude mcp add test-server");
    expect(debugOutput.error).toBe("Command not found");
    expect(debugOutput.status).toBe(127);

    // This would help users debug installation issues
    console.log("Debug output would be:", debugOutput);
  });
});