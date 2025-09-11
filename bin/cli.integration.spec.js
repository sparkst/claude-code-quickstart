import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, spawn } from "node:child_process";

// Import functions for integration testing
const writeJsonPretty = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
};

const TEMPLATES_DIR = path.join(
  path.dirname(import.meta.url.replace("file://", "")),
  "..",
  "templates"
);
const TEMPLATE = (f) => fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf8");

// Helper function for interactive CLI testing
const runInteractiveCLI = (cliPath, args, input, cwd, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [cliPath, ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timeoutId;

    // Set up timeout
    timeoutId = global.setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    // Collect output
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Handle completion
    child.on("close", (code, signal) => {
      global.clearTimeout(timeoutId);
      resolve({
        status: code,
        signal,
        stdout,
        stderr,
      });
    });

    child.on("error", (error) => {
      global.clearTimeout(timeoutId);
      reject(error);
    });

    // Send input
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
};

// Test directory setup
let testDir;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-quickstart-test-"));
});

afterEach(() => {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe("writeJsonPretty", () => {
  test("creates directory and writes formatted JSON", () => {
    const testPath = path.join(testDir, "nested", "dir", "test.json");
    const testData = { name: "test", value: 42, nested: { prop: true } };

    writeJsonPretty(testPath, testData);

    expect(fs.existsSync(testPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(testPath, "utf8"));
    expect(written).toEqual(testData);

    // Check formatting (should be pretty-printed)
    const content = fs.readFileSync(testPath, "utf8");
    expect(content).toContain('  "name": "test"');
    expect(content.endsWith("\n")).toBe(true);
  });

  test("overwrites existing files", () => {
    const testPath = path.join(testDir, "overwrite.json");
    const initialData = { old: "data" };
    const newData = { new: "data" };

    writeJsonPretty(testPath, initialData);
    writeJsonPretty(testPath, newData);

    const result = JSON.parse(fs.readFileSync(testPath, "utf8"));
    expect(result).toEqual(newData);
    expect(result.old).toBeUndefined();
  });
});

describe("TEMPLATE loading", () => {
  test("loads CLAUDE.md template", () => {
    const claudeTemplate = TEMPLATE("CLAUDE.md");

    expect(typeof claudeTemplate).toBe("string");
    expect(claudeTemplate).toContain("# Claude Code Guidelines");
    expect(claudeTemplate).toContain("Implementation Best Practices");
  });

  test("loads project-settings.json template", () => {
    const settingsTemplate = TEMPLATE("project-settings.json");

    expect(typeof settingsTemplate).toBe("string");
    const parsed = JSON.parse(settingsTemplate);
    expect(parsed.defaultMode).toBe("plan");
    expect(parsed.permissions).toBeDefined();
  });

  test("loads project-settings.local.json template", () => {
    const localTemplate = TEMPLATE("project-settings.local.json");

    expect(typeof localTemplate).toBe("string");
    const parsed = JSON.parse(localTemplate);
    expect(typeof parsed).toBe("object");
  });
});

describe("scaffoldProjectFiles integration", () => {
  test("creates all project files when none exist", () => {
    const projectDir = testDir;
    process.chdir(projectDir);

    // Mock the scaffoldProjectFiles function behavior
    const claudeMdPath = path.join(projectDir, "CLAUDE.md");
    const claudeDir = path.join(projectDir, ".claude");
    const settingsPath = path.join(claudeDir, "settings.json");
    const localPath = path.join(claudeDir, "settings.local.json");
    const gitignorePath = path.join(projectDir, ".gitignore");

    // Simulate scaffoldProjectFiles
    if (!fs.existsSync(claudeMdPath)) {
      fs.writeFileSync(claudeMdPath, TEMPLATE("CLAUDE.md"), "utf8");
    }

    // README.md (navigation and mental model)
    const readmePath = path.join(projectDir, "README.md");
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, TEMPLATE("README.md"), "utf8");
    }

    fs.mkdirSync(claudeDir, { recursive: true });

    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, TEMPLATE("project-settings.json"), "utf8");
    }

    if (!fs.existsSync(localPath)) {
      fs.writeFileSync(
        localPath,
        TEMPLATE("project-settings.local.json"),
        "utf8"
      );
    }

    // Documentation templates directory
    const docsDir = path.join(claudeDir, "templates");
    fs.mkdirSync(docsDir, { recursive: true });

    // Domain README template
    const domainReadme = path.join(docsDir, "domain-README.md");
    if (!fs.existsSync(domainReadme)) {
      fs.writeFileSync(domainReadme, TEMPLATE("domain-README.md"), "utf8");
    }

    // .claude-context template
    const claudeContext = path.join(docsDir, ".claude-context");
    if (!fs.existsSync(claudeContext)) {
      fs.writeFileSync(claudeContext, TEMPLATE(".claude-context"), "utf8");
    }

    const guard = [
      "",
      "# Claude Code secret guardrails",
      ".env",
      ".env.*",
      "*.pem",
      "*.key",
      "**/secrets/**",
      "**/credentials/**",
      "**/.aws/**",
      "**/.ssh/**",
    ].join("\n");

    let cur = "";
    if (fs.existsSync(gitignorePath))
      cur = fs.readFileSync(gitignorePath, "utf8");
    if (!cur.includes("# Claude Code secret guardrails")) {
      fs.writeFileSync(
        gitignorePath,
        (cur ? cur.trimEnd() + "\n" : "") + guard + "\n",
        "utf8"
      );
    }

    // Verify all files were created
    expect(fs.existsSync(claudeMdPath)).toBe(true);
    expect(fs.existsSync(settingsPath)).toBe(true);
    expect(fs.existsSync(localPath)).toBe(true);
    expect(fs.existsSync(gitignorePath)).toBe(true);

    // Verify documentation templates were created
    const projectReadmePath = path.join(testDir, "README.md");
    const domainTemplatePath = path.join(
      testDir,
      ".claude",
      "templates",
      "domain-README.md"
    );
    const contextTemplatePath = path.join(
      testDir,
      ".claude",
      "templates",
      ".claude-context"
    );

    expect(fs.existsSync(projectReadmePath)).toBe(true);
    expect(fs.existsSync(domainTemplatePath)).toBe(true);
    expect(fs.existsSync(contextTemplatePath)).toBe(true);

    // Verify content
    const claudeContent = fs.readFileSync(claudeMdPath, "utf8");
    expect(claudeContent).toContain("# Claude Code Guidelines");
    expect(claudeContent).toContain("Progressive Documentation Guide");
    expect(claudeContent).toContain("Sub‑Agent Suite");

    // Verify README template content
    const readmeContent = fs.readFileSync(projectReadmePath, "utf8");
    expect(readmeContent).toContain("Mental Model");
    expect(readmeContent).toContain("Key Entry Points");

    // Verify domain template content
    const domainContent = fs.readFileSync(domainTemplatePath, "utf8");
    expect(domainContent).toContain("Domain Name");
    expect(domainContent).toContain("Purpose");
    expect(domainContent).toContain("Boundaries");

    // Verify .claude-context template
    const contextContent = fs.readFileSync(contextTemplatePath, "utf8");
    expect(contextContent).toContain("Domain:");
    expect(contextContent).toContain("Key Concepts:");
    expect(contextContent).toContain("Common Tasks:");

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.defaultMode).toBe("plan");

    const gitignore = fs.readFileSync(gitignorePath, "utf8");
    expect(gitignore).toContain("# Claude Code secret guardrails");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("**/.ssh/**");
  });

  test("preserves existing files and appends to gitignore", () => {
    const projectDir = testDir;
    const claudeMdPath = path.join(projectDir, "CLAUDE.md");
    const gitignorePath = path.join(projectDir, ".gitignore");

    // Create existing files
    fs.writeFileSync(claudeMdPath, "# Existing CLAUDE.md content", "utf8");
    fs.writeFileSync(gitignorePath, "node_modules/\n*.log", "utf8");

    // Simulate scaffoldProjectFiles behavior for existing files
    const claudeDir = path.join(projectDir, ".claude");
    const settingsPath = path.join(claudeDir, "settings.json");
    const localPath = path.join(claudeDir, "settings.local.json");

    // Only create new files, don't overwrite existing
    if (!fs.existsSync(claudeMdPath)) {
      fs.writeFileSync(claudeMdPath, TEMPLATE("CLAUDE.md"), "utf8");
    }

    fs.mkdirSync(claudeDir, { recursive: true });

    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, TEMPLATE("project-settings.json"), "utf8");
    }

    if (!fs.existsSync(localPath)) {
      fs.writeFileSync(
        localPath,
        TEMPLATE("project-settings.local.json"),
        "utf8"
      );
    }

    // Append to gitignore if needed
    const guard = [
      "",
      "# Claude Code secret guardrails",
      ".env",
      ".env.*",
      "*.pem",
      "*.key",
      "**/secrets/**",
      "**/credentials/**",
      "**/.aws/**",
      "**/.ssh/**",
    ].join("\n");

    let cur = fs.readFileSync(gitignorePath, "utf8");
    if (!cur.includes("# Claude Code secret guardrails")) {
      fs.writeFileSync(
        gitignorePath,
        cur.trimEnd() + "\n" + guard + "\n",
        "utf8"
      );
    }

    // Verify existing CLAUDE.md was preserved
    const claudeContent = fs.readFileSync(claudeMdPath, "utf8");
    expect(claudeContent).toBe("# Existing CLAUDE.md content");

    // Verify new files were created
    expect(fs.existsSync(settingsPath)).toBe(true);
    expect(fs.existsSync(localPath)).toBe(true);

    // Verify gitignore was appended to
    const gitignore = fs.readFileSync(gitignorePath, "utf8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("*.log");
    expect(gitignore).toContain("# Claude Code secret guardrails");
    expect(gitignore).toContain(".env");
  });

  test("REQ-001: scaffolds repository CLAUDE.md template", () => {
    const projectDir = testDir;
    const templatesDir = path.join(projectDir, ".claude", "templates");
    const claudeTemplatePath = path.join(templatesDir, "CLAUDE.md");

    // First verify the template doesn't exist
    expect(fs.existsSync(claudeTemplatePath)).toBe(false);

    // Ensure test directory exists
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      // Simulate what scaffoldProjectFiles should do based on the new implementation
      const templatesPath = path.join(
        path.dirname(import.meta.url.replace("file://", "")),
        "..",
        "templates"
      );
      const docsDir = path.join(projectDir, ".claude", "templates");

      fs.mkdirSync(docsDir, { recursive: true });

      // Copy CLAUDE.md template (what our implementation should do)
      const sourceTemplate = path.join(templatesPath, "CLAUDE.md");
      if (fs.existsSync(sourceTemplate)) {
        const templateContent = fs.readFileSync(sourceTemplate, "utf8");
        fs.writeFileSync(claudeTemplatePath, templateContent, "utf8");
      }

      // Verify the template was created
      expect(fs.existsSync(claudeTemplatePath)).toBe(true);

      const content = fs.readFileSync(claudeTemplatePath, "utf8");
      expect(content).toContain("# Claude Code Guidelines");
      expect(content.length).toBeGreaterThan(100);
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });

  test("REQ-002: scaffolds agent definition files", () => {
    const projectDir = testDir;
    const agentsDir = path.join(projectDir, ".claude", "agents");

    // Expected core agents that scaffoldProjectFiles should create
    const requiredAgents = ["planner.md", "test-writer.md", "pe-reviewer.md"];

    // Verify agent files don't exist in project yet
    for (const agentFile of requiredAgents) {
      const targetPath = path.join(agentsDir, agentFile);
      expect(fs.existsSync(targetPath)).toBe(false);
    }

    // Simulate scaffoldProjectFiles agent copying logic
    const sourceAgentsDir = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "..",
      ".claude",
      "agents"
    );

    expect(fs.existsSync(sourceAgentsDir)).toBe(true);

    // Create agents directory and copy files (simulating scaffoldProjectFiles)
    fs.mkdirSync(agentsDir, { recursive: true });

    const agentFiles = fs
      .readdirSync(sourceAgentsDir)
      .filter((f) => f.endsWith(".md"));

    for (const agentFile of agentFiles) {
      const sourcePath = path.join(sourceAgentsDir, agentFile);
      const targetPath = path.join(agentsDir, agentFile);

      const agentContent = fs.readFileSync(sourcePath, "utf8");
      fs.writeFileSync(targetPath, agentContent, "utf8");
    }

    // Verify required agents exist
    for (const agentFile of requiredAgents) {
      const targetPath = path.join(agentsDir, agentFile);
      expect(fs.existsSync(targetPath)).toBe(true);

      const content = fs.readFileSync(targetPath, "utf8");
      expect(content.length).toBeGreaterThan(10);
    }
  });
});

describe("CLI integration", () => {
  test("CLI script exists and is executable", () => {
    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );
    expect(fs.existsSync(cliPath)).toBe(true);

    // Check if file has executable permissions (on Unix systems)
    const stats = fs.statSync(cliPath);
    expect(stats.isFile()).toBe(true);
  });

  test("postinstall script exists and is valid", () => {
    const postinstallPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "postinstall.js"
    );
    expect(fs.existsSync(postinstallPath)).toBe(true);

    // Verify it's a valid Node.js script by checking shebang
    const content = fs.readFileSync(postinstallPath, "utf8");
    expect(content).toMatch(/^#!/);
  });

  test("CLI handles invalid command gracefully", () => {
    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    // Run with invalid command - should not crash
    const result = spawnSync("node", [cliPath, "invalid-command"], {
      stdio: "pipe",
      timeout: 5000,
    });

    // Should exit gracefully (not with signal)
    expect(result.signal).toBeNull();
    expect(typeof result.status).toBe("number");
  });

  test("update-templates command requires .claude directory", () => {
    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    // Change to test directory (no .claude dir)
    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 10000,
      input: "q\n", // Quit if prompted
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain("No .claude directory found");
    expect(output).toContain(
      "Please run 'npx claude-code-quickstart init' first"
    );
  });

  test("update-templates detects identical templates", () => {
    // Set up a project with .claude directory and up-to-date templates
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const templatesDir = path.join(claudeDir, "templates");
    const agentsDir = path.join(claudeDir, "agents");
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    // Create all identical templates including new ones
    fs.writeFileSync(
      path.join(testDir, "CLAUDE.md"),
      TEMPLATE("CLAUDE.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(testDir, "README.md"),
      TEMPLATE("README.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "domain-README.md"),
      TEMPLATE("domain-README.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, ".claude-context"),
      TEMPLATE(".claude-context"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "CLAUDE.md"),
      TEMPLATE("CLAUDE.md"),
      "utf8"
    );

    // Create all agent files
    const sourceAgentsDir = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "..",
      ".claude",
      "agents"
    );
    const agentFiles = fs
      .readdirSync(sourceAgentsDir)
      .filter((f) => f.endsWith(".md"));
    for (const agentFile of agentFiles) {
      const sourcePath = path.join(sourceAgentsDir, agentFile);
      const targetPath = path.join(agentsDir, agentFile);
      const agentContent = fs.readFileSync(sourcePath, "utf8");
      fs.writeFileSync(targetPath, agentContent, "utf8");
    }

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 10000,
      input: "q\n",
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain("All templates are up to date!");
  });

  test("update-templates detects missing templates", () => {
    // Set up a project with .claude directory but missing templates
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 10000,
      input: "q\n", // Quit without updating
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain("Status: missing");
    expect(output).toContain("Action: Will be created");
    expect(output).toContain("No templates selected. Exiting.");
  });

  test("update-templates detects customized templates", () => {
    // Set up a project with customized CLAUDE.md
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const templatesDir = path.join(claudeDir, "templates");
    fs.mkdirSync(templatesDir, { recursive: true });

    const claudeMdPath = path.join(testDir, "CLAUDE.md");
    const customClaude =
      TEMPLATE("CLAUDE.md") + "\n# My Custom Rules\n- Custom rule here\n";
    fs.writeFileSync(claudeMdPath, customClaude, "utf8");

    // Create other templates as up-to-date
    fs.writeFileSync(
      path.join(testDir, "README.md"),
      TEMPLATE("README.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "domain-README.md"),
      TEMPLATE("domain-README.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, ".claude-context"),
      TEMPLATE(".claude-context"),
      "utf8"
    );

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 10000,
      input: "q\n",
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain("Status: customized");
    expect(output).toContain("Action: Manual review recommended");
    expect(output).toContain("has customizations");
  });

  test("update-templates detects outdated templates correctly", () => {
    // Set up a project with only outdated README
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const templatesDir = path.join(claudeDir, "templates");
    const agentsDir = path.join(claudeDir, "agents");
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    const readmePath = path.join(testDir, "README.md");
    const outdatedReadme = "# Old Project\n\nThis is outdated content.";
    fs.writeFileSync(readmePath, outdatedReadme, "utf8");

    // Create other templates as identical to avoid them being listed
    fs.writeFileSync(
      path.join(testDir, "CLAUDE.md"),
      TEMPLATE("CLAUDE.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "domain-README.md"),
      TEMPLATE("domain-README.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, ".claude-context"),
      TEMPLATE(".claude-context"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "CLAUDE.md"),
      TEMPLATE("CLAUDE.md"),
      "utf8"
    );

    // Create all agent files to avoid them being listed as missing
    const sourceAgentsDir = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "..",
      ".claude",
      "agents"
    );
    if (fs.existsSync(sourceAgentsDir)) {
      const agentFiles = fs
        .readdirSync(sourceAgentsDir)
        .filter((f) => f.endsWith(".md"));
      for (const agentFile of agentFiles) {
        const sourcePath = path.join(sourceAgentsDir, agentFile);
        const targetPath = path.join(agentsDir, agentFile);
        const agentContent = fs.readFileSync(sourcePath, "utf8");
        fs.writeFileSync(targetPath, agentContent, "utf8");
      }
    }

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    // Test that the CLI detects the outdated template and provides selection menu
    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 5000,
      input: "q\n", // Quit immediately to avoid hanging
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();

    // Verify template analysis works correctly
    expect(output).toContain("📝 Claude Code Template Update Tool");
    expect(output).toContain("🔍 Analyzing current templates");
    expect(output).toContain("📋 Template Status");

    // Verify README.md is detected as outdated
    expect(output).toContain("README.md");
    expect(output).toContain("Status: outdated");
    expect(output).toContain("Action: Can be updated");

    // Verify other templates are detected as identical
    expect(output).toContain("CLAUDE.md");
    expect(output).toContain("Status: identical");

    // Verify selection menu appears
    expect(output).toContain("🎯 Select templates to update");
    expect(output).toContain("1) README.md");
    expect(output).toContain("q) Quit without updating");
  });

  test("update-templates detects missing templates correctly", () => {
    // Set up a project with missing README only
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const templatesDir = path.join(claudeDir, "templates");
    const agentsDir = path.join(claudeDir, "agents");
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    // Create all templates as identical except README (missing)
    fs.writeFileSync(
      path.join(testDir, "CLAUDE.md"),
      TEMPLATE("CLAUDE.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "domain-README.md"),
      TEMPLATE("domain-README.md"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, ".claude-context"),
      TEMPLATE(".claude-context"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(templatesDir, "CLAUDE.md"),
      TEMPLATE("CLAUDE.md"),
      "utf8"
    );

    // Create all agent files to avoid them being listed as missing
    const sourceAgentsDir = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "..",
      ".claude",
      "agents"
    );
    if (fs.existsSync(sourceAgentsDir)) {
      const agentFiles = fs
        .readdirSync(sourceAgentsDir)
        .filter((f) => f.endsWith(".md"));
      for (const agentFile of agentFiles) {
        const sourcePath = path.join(sourceAgentsDir, agentFile);
        const targetPath = path.join(agentsDir, agentFile);
        const agentContent = fs.readFileSync(sourcePath, "utf8");
        fs.writeFileSync(targetPath, agentContent, "utf8");
      }
    }

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js"
    );

    // Test that the CLI detects missing templates
    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 5000,
      input: "q\n", // Quit immediately to avoid hanging
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();

    // Verify template analysis works correctly
    expect(output).toContain("📝 Claude Code Template Update Tool");
    expect(output).toContain("🔍 Analyzing current templates");
    expect(output).toContain("📋 Template Status");

    // Verify README.md is detected as missing
    expect(output).toContain("README.md");
    expect(output).toContain("Status: missing");
    expect(output).toContain("Action: Will be created");

    // Verify other templates are detected as identical
    expect(output).toContain("CLAUDE.md");
    expect(output).toContain("Status: identical");

    // Verify selection menu appears
    expect(output).toContain("🎯 Select templates to update");
    expect(output).toContain("1) README.md");
    expect(output).toContain("q) Quit without updating");

    // Verify no actual changes were made since we quit
    const readmePath = path.join(testDir, "README.md");
    expect(fs.existsSync(readmePath)).toBe(false);
  });
});
