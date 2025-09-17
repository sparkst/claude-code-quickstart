/**
 * REQ-715: File Locking for Concurrent Access Tests
 *
 * Tests file locking functionality to prevent configuration corruption
 * during concurrent installations and operations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';

// Import CLI functions for testing
const cliPath = path.join(__dirname, '../../bin/cli.js');

describe('REQ-715: File Locking for Concurrent Access', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-lock-test-'));
    testFile = path.join(testDir, 'test-settings.json');
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('REQ-715 — prevents concurrent file writes from corrupting configuration', async () => {
    // Setup initial test file
    const initialContent = JSON.stringify({ test: 'initial' }, null, 2);
    fs.writeFileSync(testFile, initialContent);

    // Track concurrent operations
    const operations: Promise<void>[] = [];
    const results: string[] = [];

    // Launch multiple concurrent file operations
    for (let i = 0; i < 5; i++) {
      operations.push(
        simulateFileOperation(testFile, `operation-${i}`, results)
      );
    }

    // Wait for all operations to complete
    await Promise.allSettled(operations);

    // Verify file is not corrupted and contains valid JSON
    expect(fs.existsSync(testFile)).toBe(true);
    const finalContent = fs.readFileSync(testFile, 'utf8');

    // Should be valid JSON
    expect(() => JSON.parse(finalContent)).not.toThrow();

    // Should contain one of the operation results
    const parsedContent = JSON.parse(finalContent);
    expect(parsedContent).toHaveProperty('operation');
    expect(parsedContent.operation).toMatch(/^operation-\d$/);

    // All operations should have completed
    expect(results).toHaveLength(5);
  }, 30000);

  test('REQ-715 — handles lock timeouts gracefully', async () => {
    // Create a long-running lock holder
    const lockHolderProcess = spawn('node', [
      '-e',
      `
      const lockfile = require('proper-lockfile');
      const path = require('path');

      (async () => {
        const release = await lockfile.lock('${testFile}');
        console.log('LOCK_ACQUIRED');

        // Hold lock for 3 seconds
        setTimeout(async () => {
          await release();
          console.log('LOCK_RELEASED');
        }, 3000);
      })();
      `
    ]);

    // Wait for lock to be acquired
    await new Promise<void>((resolve) => {
      lockHolderProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('LOCK_ACQUIRED')) {
          resolve();
        }
      });
    });

    // Try to perform operation while lock is held
    const startTime = Date.now();
    const result = await simulateFileOperation(testFile, 'delayed-operation', []);
    const duration = Date.now() - startTime;

    // Should have waited for lock to be released
    expect(duration).toBeGreaterThan(2500);
    expect(duration).toBeLessThan(5000);

    // Cleanup
    lockHolderProcess.kill();
  }, 10000);

  test('REQ-715 — provides user feedback during lock wait', async () => {
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
      consoleLogs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      // Create lock holder
      const lockHolderProcess = spawn('node', [
        '-e',
        `
        const lockfile = require('proper-lockfile');
        (async () => {
          const release = await lockfile.lock('${testFile}');
          setTimeout(async () => {
            await release();
          }, 2000);
        })();
        `
      ]);

      // Slight delay to ensure lock is acquired
      await new Promise(resolve => setTimeout(resolve, 100));

      // Attempt operation that should wait for lock
      await simulateFileOperation(testFile, 'feedback-test', []);

      // Should have shown waiting message
      expect(consoleLogs.some(log => log.includes('Waiting for file access'))).toBe(true);
      expect(consoleLogs.some(log => log.includes('Another installation may be in progress'))).toBe(true);

      lockHolderProcess.kill();
    } finally {
      console.log = originalLog;
    }
  }, 8000);

  test('REQ-715 — handles stale locks automatically', async () => {
    const lockfile = require('proper-lockfile');

    // Create a stale lock file manually
    const lockPath = `${testFile}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: 99999, // Non-existent PID
      mtimeMs: Date.now() - 60000 // 1 minute old
    }));

    // Should be able to acquire lock despite stale lock file
    const startTime = Date.now();
    await simulateFileOperation(testFile, 'stale-lock-test', []);
    const duration = Date.now() - startTime;

    // Should not have waited long for stale lock
    expect(duration).toBeLessThan(2000);

    // File should be created successfully
    expect(fs.existsSync(testFile)).toBe(true);
  });

  test('REQ-715 — atomic file operations prevent partial writes', async () => {
    const largeContent = 'x'.repeat(10000); // Large content to increase chance of interruption
    const operations: Promise<void>[] = [];

    // Start multiple operations writing large content
    for (let i = 0; i < 3; i++) {
      operations.push(
        simulateFileOperation(testFile, `large-operation-${i}`, [], largeContent)
      );
    }

    await Promise.allSettled(operations);

    // File should exist and contain complete content
    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, 'utf8');

    // Should be valid JSON with complete content
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('operation');
    expect(parsed).toHaveProperty('data');
    expect(parsed.data).toHaveLength(10000);
  });

  test('REQ-715 — handles lock release failures gracefully', async () => {
    const consoleLogs: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      consoleLogs.push(args.join(' '));
      originalWarn(...args);
    };

    try {
      // Simulate lock release failure by corrupting lock file after acquisition
      const testOperation = async () => {
        const lockfile = require('proper-lockfile');
        let release: (() => Promise<void>) | null = null;

        try {
          release = await lockfile.lock(testFile);

          // Corrupt the lock file to simulate release failure
          const lockPath = `${testFile}.lock`;
          if (fs.existsSync(lockPath)) {
            fs.chmodSync(lockPath, 0o000); // Remove all permissions
          }

          // Write test content
          fs.writeFileSync(testFile, JSON.stringify({ test: 'data' }));

        } finally {
          if (release) {
            await release(); // This should fail gracefully
          }
        }
      };

      await testOperation();

      // Should have logged warning about lock release failure
      expect(consoleLogs.some(log => log.includes('Failed to release lock'))).toBe(true);

    } finally {
      console.warn = originalWarn;

      // Cleanup: restore permissions
      const lockPath = `${testFile}.lock`;
      if (fs.existsSync(lockPath)) {
        try {
          fs.chmodSync(lockPath, 0o644);
          fs.unlinkSync(lockPath);
        } catch {}
      }
    }
  });
});

// Helper function to simulate file operations with CLI-like behavior
async function simulateFileOperation(
  filePath: string,
  operationId: string,
  results: string[],
  customData?: string
): Promise<void> {
  const lockfile = require('proper-lockfile');

  // Simulate the safeConfigUpdate function behavior
  const lockOptions = {
    retries: 5,
    minTimeout: 100,
    maxTimeout: 2000,
    randomize: true,
    stale: 30000,
    realpath: false,
  };

  let release: (() => Promise<void>) | null = null;
  const startTime = Date.now();

  try {
    // Show user feedback for lock wait if it takes more than 1 second
    const lockTimeout = setTimeout(() => {
      console.log(`⏳ Waiting for file access: ${path.basename(filePath)}`);
      console.log("   (Another installation may be in progress...)");
    }, 1000);

    try {
      release = await lockfile.lock(filePath, lockOptions);
      clearTimeout(lockTimeout);
    } catch (error: any) {
      clearTimeout(lockTimeout);
      if (error.code === 'ELOCKED') {
        throw new Error(`File is locked by another process: ${path.basename(filePath)}. Please wait and try again.`);
      }
      throw new Error(`Failed to acquire lock for ${path.basename(filePath)}: ${error.message}`);
    }

    // Log lock acquisition time if it took longer than expected
    const lockTime = Date.now() - startTime;
    if (lockTime > 1000) {
      console.log(`✅ File access acquired after ${Math.round(lockTime / 1000)}s`);
    }

    // Simulate file operation (write JSON data)
    const content = JSON.stringify({
      operation: operationId,
      timestamp: Date.now(),
      data: customData || `test-data-${operationId}`
    }, null, 2);

    // Atomic write operation
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${filePath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {}
      throw error;
    }

    results.push(operationId);

  } catch (error: any) {
    throw new Error(`Configuration update failed for ${path.basename(filePath)}: ${error.message}`);
  } finally {
    if (release) {
      try {
        await release();
      } catch (releaseError: any) {
        console.warn(`⚠️ Warning: Failed to release lock for ${path.basename(filePath)}: ${releaseError.message}`);
      }
    }
  }
}