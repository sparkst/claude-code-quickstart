/**
 * Test Environment Tests - TDD for missing test environment utilities
 * REQ-500: Missing Test Utilities Infrastructure
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import type { TestEnvironment } from "./e2e-types.js";

// This import SHOULD work after implementation but WILL FAIL initially
let createTestEnvironment: () => Promise<TestEnvironment>;

try {
  const module = await import("./test-environment.js");
  createTestEnvironment = module.createTestEnvironment;
} catch (error) {
  // Function doesn't exist yet - this is expected for TDD
  createTestEnvironment = async () => {
    throw new Error("createTestEnvironment function not implemented yet - REQ-500");
  };
}

describe("REQ-500 — Test Environment Utilities", () => {
  let testEnv: TestEnvironment;

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  test("REQ-500 — createTestEnvironment function exists and returns TestEnvironment interface", async () => {
    // This SHOULD pass after implementation but WILL FAIL initially
    expect(createTestEnvironment).toBeDefined();
    expect(typeof createTestEnvironment).toBe("function");

    testEnv = await createTestEnvironment();
    expect(testEnv).toBeDefined();
    expect(typeof testEnv.tempDir).toBe("string");
    expect(typeof testEnv.cleanup).toBe("function");
    expect(typeof testEnv.createFile).toBe("function");
    expect(typeof testEnv.createDirectory).toBe("function");
  });

  test("REQ-500 — createTestEnvironment creates isolated temporary directory", async () => {
    testEnv = await createTestEnvironment();

    expect(testEnv.tempDir).toBeDefined();
    expect(path.isAbsolute(testEnv.tempDir)).toBe(true);

    // Directory should exist
    const stats = await fs.stat(testEnv.tempDir);
    expect(stats.isDirectory()).toBe(true);

    // Directory should be in system temp location
    expect(testEnv.tempDir).toContain("tmp");
  });

  test("REQ-500 — createFile creates files with correct content in temp directory", async () => {
    testEnv = await createTestEnvironment();

    const content = "test file content\nline 2";
    const filePath = await testEnv.createFile("test.txt", content);

    expect(path.isAbsolute(filePath)).toBe(true);
    expect(filePath.startsWith(testEnv.tempDir)).toBe(true);

    const actualContent = await fs.readFile(filePath, "utf-8");
    expect(actualContent).toBe(content);
  });

  test("REQ-500 — createDirectory creates nested directories in temp directory", async () => {
    testEnv = await createTestEnvironment();

    const dirPath = await testEnv.createDirectory("nested/deep/directory");

    expect(path.isAbsolute(dirPath)).toBe(true);
    expect(dirPath.startsWith(testEnv.tempDir)).toBe(true);

    const stats = await fs.stat(dirPath);
    expect(stats.isDirectory()).toBe(true);
  });

  test("REQ-500 — cleanup removes temporary directory and all contents", async () => {
    testEnv = await createTestEnvironment();

    const tempDir = testEnv.tempDir;
    await testEnv.createFile("test.txt", "content");
    await testEnv.createDirectory("subdir");

    // Verify directory exists before cleanup
    const statsBefore = await fs.stat(tempDir);
    expect(statsBefore.isDirectory()).toBe(true);

    await testEnv.cleanup();

    // Directory should be removed after cleanup
    await expect(fs.stat(tempDir)).rejects.toThrow();
  });

  test("REQ-500 — test environment handles concurrent file operations safely", async () => {
    testEnv = await createTestEnvironment();

    // Create multiple files concurrently
    const promises = Array.from({ length: 10 }, (_, i) =>
      testEnv.createFile(`file${i}.txt`, `content ${i}`)
    );

    const filePaths = await Promise.all(promises);

    // All files should be created successfully
    expect(filePaths).toHaveLength(10);

    for (let i = 0; i < 10; i++) {
      const content = await fs.readFile(filePaths[i], "utf-8");
      expect(content).toBe(`content ${i}`);
    }
  });
});