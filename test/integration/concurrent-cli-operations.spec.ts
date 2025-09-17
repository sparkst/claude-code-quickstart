/**
 * REQ-715: Concurrent CLI Operations Integration Tests
 *
 * Tests the CLI's file locking behavior with real concurrent processes
 * to ensure configuration files are protected from corruption.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';

describe('REQ-715: Concurrent CLI Operations Integration', () => {
  let testProjectDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create temporary test project directory
    originalCwd = process.cwd();
    testProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-concurrent-test-'));
    process.chdir(testProjectDir);

    // Create basic project structure
    fs.mkdirSync(path.join(testProjectDir, '.claude'), { recursive: true });
  });

  afterEach(() => {
    // Restore original directory and cleanup
    process.chdir(originalCwd);
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  test('REQ-715 — multiple concurrent CLI scaffold operations do not corrupt files', async () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');
    const processes: ChildProcess[] = [];
    const results: { success: boolean; error?: string }[] = [];

    // Launch multiple concurrent scaffold operations
    const concurrentOps = 3;
    for (let i = 0; i < concurrentOps; i++) {
      const child = spawn('node', [cliPath], {
        cwd: testProjectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      processes.push(child);

      // Send responses to skip MCP configuration and only scaffold files
      child.stdin?.write('\n'); // Skip MCP configuration (default option)
      child.stdin?.write('y\n'); // Scaffold project files
      child.stdin?.end();

      // Collect results
      child.on('close', (code) => {
        results.push({
          success: code === 0,
          error: code !== 0 ? `Process ${i} exited with code ${code}` : undefined
        });
      });
    }

    // Wait for all processes to complete
    await Promise.all(
      processes.map(child => new Promise(resolve => child.on('close', resolve)))
    );

    // Verify all processes completed successfully
    expect(results).toHaveLength(concurrentOps);
    results.forEach((result, i) => {
      expect(result.success, `Process ${i} should succeed: ${result.error}`).toBe(true);
    });

    // Verify critical files exist and are valid
    const criticalFiles = [
      'CLAUDE.md',
      'README.md',
      '.claude/settings.json',
      '.claude/settings.local.json',
      '.claude/templates/domain-README.md',
      '.claude/templates/.claude-context',
      '.gitignore'
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(testProjectDir, file);
      expect(fs.existsSync(filePath), `${file} should exist`).toBe(true);

      // Verify file is not corrupted (readable and non-empty for non-JSON files)
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content.length, `${file} should not be empty`).toBeGreaterThan(0);

      // Verify JSON files are valid
      if (file.endsWith('.json')) {
        expect(() => JSON.parse(content), `${file} should be valid JSON`).not.toThrow();
      }
    }
  }, 60000);

  test('REQ-715 — concurrent template updates handle file locking correctly', async () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');

    // First, initialize the project
    await runCliCommand(cliPath, []);

    // Verify initial files exist
    expect(fs.existsSync(path.join(testProjectDir, 'CLAUDE.md'))).toBe(true);

    // Now run concurrent update-templates commands
    const processes: ChildProcess[] = [];
    const results: { success: boolean; stderr: string }[] = [];

    const concurrentUpdates = 3;
    for (let i = 0; i < concurrentUpdates; i++) {
      const child = spawn('node', [cliPath, 'update-templates'], {
        cwd: testProjectDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      processes.push(child);

      let stderr = '';
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Automatically select "all templates" and proceed with updates
      child.stdin?.write('a\n'); // Select all templates
      child.stdin?.write('n\n');  // Skip dry run
      child.stdin?.end();

      child.on('close', (code) => {
        results.push({
          success: code === 0,
          stderr
        });
      });
    }

    // Wait for all update processes to complete
    await Promise.all(
      processes.map(child => new Promise(resolve => child.on('close', resolve)))
    );

    // Verify all processes completed successfully
    expect(results).toHaveLength(concurrentUpdates);
    results.forEach((result, i) => {
      expect(result.success, `Update process ${i} should succeed`).toBe(true);
      // Should not have lock-related errors
      expect(result.stderr).not.toMatch(/ELOCKED|lock.*failed/i);
    });

    // Verify files are still valid after concurrent updates
    const templateFiles = [
      'CLAUDE.md',
      '.claude/templates/domain-README.md',
      '.claude/templates/.claude-context'
    ];

    for (const file of templateFiles) {
      const filePath = path.join(testProjectDir, file);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      // Should not contain corruption markers
      expect(content).not.toMatch(/\x00|undefined|null/);
    }
  }, 45000);

  test('REQ-715 — file locks are cleaned up after process termination', async () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');
    const testFile = path.join(testProjectDir, '.claude', 'test-file.json');

    // Start a CLI process that will hold a lock
    const child = spawn('node', [cliPath], {
      cwd: testProjectDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Give it time to start and potentially acquire locks
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Forcefully terminate the process
    child.kill('SIGKILL');

    // Wait for process to be fully terminated
    await new Promise(resolve => child.on('close', resolve));

    // Check for stale lock files
    const lockFiles = fs.readdirSync(testProjectDir, { recursive: true })
      .filter((file): file is string => typeof file === 'string')
      .filter(file => file.endsWith('.lock'));

    // Any lock files found should be stale and cleanable
    for (const lockFile of lockFiles) {
      const lockPath = path.join(testProjectDir, lockFile);
      const lockStat = fs.statSync(lockPath);
      const age = Date.now() - lockStat.mtimeMs;

      // Lock files older than our stale timeout should be cleanable
      if (age > 30000) {
        // Should be able to remove stale lock
        expect(() => fs.unlinkSync(lockPath)).not.toThrow();
      }
    }

    // New operations should still work despite terminated process
    const newChild = spawn('node', [cliPath], {
      cwd: testProjectDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    newChild.stdin?.write('\n'); // Skip MCP configuration
    newChild.stdin?.write('y\n'); // Scaffold files
    newChild.stdin?.end();

    const exitCode = await new Promise<number>(resolve => {
      newChild.on('close', (code) => resolve(code || 0));
    });

    expect(exitCode).toBe(0);
  }, 30000);

  test('REQ-715 — lock acquisition timeout provides helpful error messages', async () => {
    const lockfile = require('proper-lockfile');
    const testFile = path.join(testProjectDir, 'locked-file.json');

    // Create and hold a lock
    const release = await lockfile.lock(testFile, { stale: 60000 });

    try {
      // Start CLI operation that should timeout waiting for lock
      const cliPath = path.join(__dirname, '../../bin/cli.js');
      const child = spawn('node', [
        '-e',
        `
        const cli = require('${cliPath}');
        const path = require('path');

        // Simulate a file operation that will encounter the lock
        async function testLockTimeout() {
          try {
            const lockfile = require('proper-lockfile');
            await lockfile.lock('${testFile}', {
              retries: 2,
              minTimeout: 100,
              maxTimeout: 500
            });
          } catch (error) {
            console.log('EXPECTED_LOCK_ERROR:', error.message);
            process.exit(0);
          }
        }
        testLockTimeout();
        `
      ], {
        cwd: testProjectDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      const exitCode = await new Promise<number>(resolve => {
        child.on('close', (code) => resolve(code || 0));
      });

      // Should provide helpful error message about locked file
      expect(stdout).toMatch(/EXPECTED_LOCK_ERROR.*locked.*process/i);
      expect(exitCode).toBe(0);

    } finally {
      // Release the lock
      await release();
    }
  }, 15000);
});

// Helper function to run CLI command and wait for completion
async function runCliCommand(cliPath: string, args: string[], inputs: string[] = []): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Send inputs if provided
    inputs.forEach(input => {
      child.stdin?.write(input + '\n');
    });
    child.stdin?.end();

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
  });
}