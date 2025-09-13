/**
 * Test Environment Module - Environment setup and management
 * REQ-500: Missing test utilities infrastructure
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Creates a test environment with temporary directories and settings
 * REQ-500: Missing createTestEnvironment function
 */
export async function createTestEnvironment(config = {}) {
  const testId = Date.now().toString();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `claude-test-${testId}-`));

  return {
    id: testId,
    tmpDir,
    cwd: tmpDir,
    env: {
      NODE_ENV: 'test',
      ...config.env
    },

    async cleanup() {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup test environment: ${error.message}`);
      }
    },

    async writeFile(fileName, content) {
      const filePath = path.join(tmpDir, fileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
      return filePath;
    },

    async readFile(fileName) {
      const filePath = path.join(tmpDir, fileName);
      return fs.readFile(filePath, 'utf8');
    }
  };
}

/**
 * Validates test environment configuration
 * REQ-500: Environment validation
 */
export function validateTestEnvironment(env) {
  if (!env || typeof env !== 'object') {
    return false;
  }

  return env.id && env.tmpDir && env.cwd && env.env;
}