/**
 * REQ-715: File Locking Performance Tests
 *
 * Tests to ensure file locking implementation doesn't significantly
 * impact normal single-user operations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('REQ-715: File Locking Performance', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-perf-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('REQ-715 — file locking overhead is minimal for single operations', async () => {
    const testFile = path.join(testDir, 'perf-test.json');
    const iterations = 10;

    // Test direct file operations (baseline)
    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const content = JSON.stringify({ test: `baseline-${i}`, timestamp: Date.now() });
      fs.writeFileSync(testFile, content);
    }
    const baselineTime = performance.now() - baselineStart;

    // Clean up
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }

    // Test with file locking
    const lockfile = require('proper-lockfile');
    const lockedStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      let release: (() => Promise<void>) | null = null;
      try {
        release = await lockfile.lock(testFile, {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 2000,
          stale: 30000,
          realpath: false
        });

        const content = JSON.stringify({ test: `locked-${i}`, timestamp: Date.now() });
        const tempPath = `${testFile}.tmp.${Date.now()}`;
        fs.writeFileSync(tempPath, content);
        fs.renameSync(tempPath, testFile);

      } finally {
        if (release) {
          await release();
        }
      }
    }
    const lockedTime = performance.now() - lockedStart;

    // Locking overhead should be reasonable (less than 3x baseline)
    const overhead = lockedTime / baselineTime;
    console.log(`Baseline: ${baselineTime.toFixed(2)}ms, Locked: ${lockedTime.toFixed(2)}ms, Overhead: ${overhead.toFixed(2)}x`);

    expect(overhead).toBeLessThan(3.0);
    expect(lockedTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('REQ-715 — lock acquisition is fast when no contention exists', async () => {
    const testFile = path.join(testDir, 'fast-lock-test.json');
    const lockfile = require('proper-lockfile');

    const measurements: number[] = [];

    // Measure lock acquisition time without contention
    for (let i = 0; i < 5; i++) {
      const start = performance.now();

      const release = await lockfile.lock(testFile, {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 2000,
        stale: 30000,
        realpath: false
      });

      const lockTime = performance.now() - start;
      measurements.push(lockTime);

      await release();

      // Clean up lock file between iterations
      const lockPath = `${testFile}.lock`;
      if (fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      }
    }

    const avgLockTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const maxLockTime = Math.max(...measurements);

    console.log(`Average lock time: ${avgLockTime.toFixed(2)}ms, Max: ${maxLockTime.toFixed(2)}ms`);

    // Lock acquisition should be fast without contention
    expect(avgLockTime).toBeLessThan(100); // Average under 100ms
    expect(maxLockTime).toBeLessThan(500);  // Max under 500ms
  });

  test('REQ-715 — memory usage remains stable during repeated operations', async () => {
    const testFile = path.join(testDir, 'memory-test.json');
    const lockfile = require('proper-lockfile');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many lock/unlock cycles
    for (let i = 0; i < 100; i++) {
      let release: (() => Promise<void>) | null = null;
      try {
        release = await lockfile.lock(testFile, {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 2000,
          stale: 30000,
          realpath: false
        });

        // Simulate file operation
        const content = JSON.stringify({ iteration: i, data: 'x'.repeat(100) });
        fs.writeFileSync(testFile, content);

      } finally {
        if (release) {
          await release();
        }
      }

      // Periodic garbage collection
      if (i % 20 === 0 && global.gc) {
        global.gc();
      }
    }

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Memory increase should be reasonable (less than 10MB for 100 operations)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });

  test('REQ-715 — lock cleanup is efficient', async () => {
    const testFile = path.join(testDir, 'cleanup-test.json');
    const lockfile = require('proper-lockfile');

    // Create and immediately release many locks
    const start = performance.now();

    for (let i = 0; i < 20; i++) {
      const release = await lockfile.lock(testFile, {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 2000,
        stale: 30000,
        realpath: false
      });

      await release();
    }

    const duration = performance.now() - start;

    console.log(`20 lock/release cycles: ${duration.toFixed(2)}ms`);

    // Should complete quickly
    expect(duration).toBeLessThan(2000); // Under 2 seconds

    // No lock files should remain
    const lockFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.lock'));
    expect(lockFiles).toHaveLength(0);
  });
});