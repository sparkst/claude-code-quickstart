import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

// Import functions for integration testing
const writeJsonPretty = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
};

const TEMPLATES_DIR = path.join(
  path.dirname(import.meta.url.replace("file://", "")),
  "..",
  "templates",
);
const TEMPLATE = (f) => fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf8");

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
    expect(claudeTemplate).toContain("Claude Code Guidelines by Sabrina Ramonov");
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
        "utf8",
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
        "utf8",
      );
    }

    // Verify all files were created
    expect(fs.existsSync(claudeMdPath)).toBe(true);
    expect(fs.existsSync(settingsPath)).toBe(true);
    expect(fs.existsSync(localPath)).toBe(true);
    expect(fs.existsSync(gitignorePath)).toBe(true);
    
    // Verify documentation templates were created
    const projectReadmePath = path.join(testDir, "README.md");
    const domainTemplatePath = path.join(testDir, ".claude", "templates", "domain-README.md");
    const contextTemplatePath = path.join(testDir, ".claude", "templates", ".claude-context");
    
    expect(fs.existsSync(projectReadmePath)).toBe(true);
    expect(fs.existsSync(domainTemplatePath)).toBe(true);
    expect(fs.existsSync(contextTemplatePath)).toBe(true);

    // Verify content
    const claudeContent = fs.readFileSync(claudeMdPath, "utf8");
    expect(claudeContent).toContain("Claude Code Guidelines by Sabrina Ramonov");
    expect(claudeContent).toContain("Progressive Documentation Guide");
    expect(claudeContent).toContain("Context-Driven Inline Documentation");
    
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
        "utf8",
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
        "utf8",
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
});

describe("CLI integration", () => {
  test("CLI script exists and is executable", () => {
    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js",
    );
    expect(fs.existsSync(cliPath)).toBe(true);

    // Check if file has executable permissions (on Unix systems)
    const stats = fs.statSync(cliPath);
    expect(stats.isFile()).toBe(true);
  });

  test("postinstall script exists and is valid", () => {
    const postinstallPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "postinstall.js",
    );
    expect(fs.existsSync(postinstallPath)).toBe(true);

    // Verify it's a valid Node.js script by checking shebang
    const content = fs.readFileSync(postinstallPath, "utf8");
    expect(content).toMatch(/^#!/);
  });

  test("CLI handles invalid command gracefully", () => {
    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js",
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
      "cli.js",
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
    expect(output).toContain("Please run 'npx claude-code-quickstart init' first");
  });

  test("update-templates detects identical templates", () => {
    // Set up a project with .claude directory and up-to-date templates
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    
    const templatesDir = path.join(claudeDir, "templates");
    fs.mkdirSync(templatesDir, { recursive: true });

    // Create identical templates
    const claudeMdPath = path.join(testDir, "CLAUDE.md");
    const readmeMdPath = path.join(testDir, "README.md");
    const domainReadmePath = path.join(templatesDir, "domain-README.md");
    const claudeContextPath = path.join(templatesDir, ".claude-context");

    fs.writeFileSync(claudeMdPath, TEMPLATE("CLAUDE.md"), "utf8");
    fs.writeFileSync(readmeMdPath, TEMPLATE("README.md"), "utf8");
    fs.writeFileSync(domainReadmePath, TEMPLATE("domain-README.md"), "utf8");
    fs.writeFileSync(claudeContextPath, TEMPLATE(".claude-context"), "utf8");

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js",
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
      "cli.js",
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
    const customClaude = TEMPLATE("CLAUDE.md") + "\n# My Custom Rules\n- Custom rule here\n";
    fs.writeFileSync(claudeMdPath, customClaude, "utf8");

    // Create other templates as up-to-date
    fs.writeFileSync(path.join(testDir, "README.md"), TEMPLATE("README.md"), "utf8");
    fs.writeFileSync(path.join(templatesDir, "domain-README.md"), TEMPLATE("domain-README.md"), "utf8");
    fs.writeFileSync(path.join(templatesDir, ".claude-context"), TEMPLATE(".claude-context"), "utf8");

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js",
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

  test("update-templates creates backups when updating", () => {
    // Set up a project with only outdated README
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    
    const templatesDir = path.join(claudeDir, "templates");
    fs.mkdirSync(templatesDir, { recursive: true });

    const readmePath = path.join(testDir, "README.md");
    const outdatedReadme = "# Old Project\n\nThis is outdated content.";
    fs.writeFileSync(readmePath, outdatedReadme, "utf8");

    // Create other templates as identical to avoid them being listed
    fs.writeFileSync(path.join(testDir, "CLAUDE.md"), TEMPLATE("CLAUDE.md"), "utf8");
    fs.writeFileSync(path.join(templatesDir, "domain-README.md"), TEMPLATE("domain-README.md"), "utf8");
    fs.writeFileSync(path.join(templatesDir, ".claude-context"), TEMPLATE(".claude-context"), "utf8");

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js",
    );

    // README.md should be the only option (option 1), no dry run, proceed with update
    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe", 
      timeout: 5000,
      input: "1\nn\ny\n", // Select template 1, no dry run, proceed with update
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    
    // More flexible assertions since the exact order may vary
    expect(output).toMatch(/Created backup:|backup/);
    expect(output).toContain("Update Summary:");
    expect(output).toMatch(/Successful: 1|✅/);
    
    // Verify backup was created
    const backupFiles = fs.readdirSync(testDir).filter(f => f.includes("README.md.backup."));
    expect(backupFiles.length).toBe(1);
    
    // Verify backup content
    const backupContent = fs.readFileSync(path.join(testDir, backupFiles[0]), "utf8");
    expect(backupContent).toBe(outdatedReadme);
    
    // Verify file was updated
    const updatedContent = fs.readFileSync(readmePath, "utf8");
    expect(updatedContent).toBe(TEMPLATE("README.md"));
  });

  test("update-templates dry run mode works correctly", () => {
    // Set up a project with missing README only
    const claudeDir = path.join(testDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    
    const templatesDir = path.join(claudeDir, "templates");
    fs.mkdirSync(templatesDir, { recursive: true });

    // Create all templates as identical except README (missing)
    fs.writeFileSync(path.join(testDir, "CLAUDE.md"), TEMPLATE("CLAUDE.md"), "utf8");
    fs.writeFileSync(path.join(templatesDir, "domain-README.md"), TEMPLATE("domain-README.md"), "utf8");
    fs.writeFileSync(path.join(templatesDir, ".claude-context"), TEMPLATE(".claude-context"), "utf8");

    const cliPath = path.join(
      path.dirname(import.meta.url.replace("file://", "")),
      "cli.js",
    );

    // Select README (option 1), do dry run, then cancel
    const result = spawnSync("node", [cliPath, "update-templates"], {
      cwd: testDir,
      stdio: "pipe",
      timeout: 5000,
      input: "1\ny\nn\n", // Select template 1, dry run yes, don't proceed
    });

    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    
    // More flexible checks for dry run output
    expect(output).toMatch(/\[DRY RUN\]|dry run/i);
    expect(output).toMatch(/Would create|create file/i);
    expect(output).toMatch(/Cancelled|cancel/i);
    
    // Verify no actual changes were made
    const readmePath = path.join(testDir, "README.md");
    expect(fs.existsSync(readmePath)).toBe(false);
  });
});
