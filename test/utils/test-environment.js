/**
 * Test Environment Module - Environment setup and management
 * REQ-500: Missing test utilities infrastructure
 */

import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Creates a test environment with temporary directories and settings
 * REQ-710: Missing createTestEnvironment function
 */
export async function createTestEnvironment(config = {}) {
  const testId = Date.now().toString();
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `claude-test-${testId}-`)
  );

  return {
    tempDir, // Match TestEnvironment interface

    async cleanup() {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup test environment: ${error.message}`);
      }
    },

    async createFile(relativePath, content) {
      const filePath = path.join(tempDir, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
      return filePath;
    },

    async createDirectory(relativePath) {
      const dirPath = path.join(tempDir, relativePath);
      await fs.mkdir(dirPath, { recursive: true });
      return dirPath;
    },
  };
}

/**
 * Validates test environment configuration
 * REQ-500: Environment validation
 */
export function validateTestEnvironment(env) {
  if (!env || typeof env !== "object") {
    return false;
  }

  return env.id && env.tmpDir && env.cwd && env.env;
}
