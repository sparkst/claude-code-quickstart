/**
 * Environment Management Module - Test environment setup and teardown
 * REQ-201: Architecture Decomposition - Focused environment management
 * REQ-205: Resource Management - Environment lifecycle management
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  createE2EEnvironment,
  destroyE2EEnvironment,
  registerCleanupCallback
} from './process-manager.js';
import type {
  E2EEnvironment,
  TestEnvironmentId,
  CleanupResult,
  E2EError
} from './types.js';

// Environment configuration
const ENVIRONMENT_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  CLAUDE_CONFIG_FILENAME: 'claude_desktop_config.json',
  DEFAULT_MCP_SERVERS: {
    github: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-github'],
      env: {}
    },
    filesystem: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
      env: {}
    }
  }
} as const;

/**
 * Creates a comprehensive E2E test environment
 * REQ-201: Environment setup with proper architecture
 */
export class E2EEnvironmentManager {
  private environments = new Map<TestEnvironmentId, E2EEnvironment>();
  
  /**
   * Creates a new test environment
   * REQ-205: Tracked environment creation
   */
  async createEnvironment(
    options: {
      readonly prefix?: string;
      readonly mcpServers?: Record<string, unknown>;
      readonly createClaudeConfig?: boolean;
    } = {}
  ): Promise<E2EEnvironment> {
    const {
      prefix = 'claude-test-e2e-',
      mcpServers = ENVIRONMENT_CONFIG.DEFAULT_MCP_SERVERS,
      createClaudeConfig = true
    } = options;

    try {
      const baseEnvironment = await createE2EEnvironment(prefix);
      
      if (createClaudeConfig) {
        const config = {
          mcpServers
        };
        
        await fs.writeFile(
          baseEnvironment.claudeConfigPath,
          JSON.stringify(config, null, 2)
        );
      }
      
      // Register for tracking
      this.environments.set(baseEnvironment.id, baseEnvironment);
      
      // Register cleanup callback
      registerCleanupCallback(async () => {
        await this.destroyEnvironment(baseEnvironment.id);
      });
      
      return baseEnvironment;
      
    } catch (error) {
      throw new Error(`Failed to create E2E environment: ${error instanceof Error ? error.message : String(error)}`) as E2EError;
    }
  }
  
  /**
   * Gets an existing environment
   * REQ-205: Environment tracking
   */
  getEnvironment(id: TestEnvironmentId): E2EEnvironment | undefined {
    return this.environments.get(id);
  }
  
  /**
   * Lists all active environments
   * REQ-205: Environment monitoring
   */
  listEnvironments(): readonly E2EEnvironment[] {
    return Array.from(this.environments.values());
  }
  
  /**
   * Destroys a specific environment
   * REQ-205: Environment cleanup
   */
  async destroyEnvironment(id: TestEnvironmentId): Promise<CleanupResult> {
    const environment = this.environments.get(id);
    if (!environment) {
      return {
        cleaned: [],
        errors: [`Environment ${id} not found`],
        success: false
      };
    }
    
    const result = await destroyE2EEnvironment(environment);
    this.environments.delete(id);
    
    return result;
  }
  
  /**
   * Destroys all environments
   * REQ-205: Complete environment cleanup
   */
  async destroyAllEnvironments(): Promise<CleanupResult> {
    const allCleaned: string[] = [];
    const allErrors: string[] = [];
    
    for (const id of this.environments.keys()) {
      const result = await this.destroyEnvironment(id);
      allCleaned.push(...result.cleaned);
      allErrors.push(...result.errors);
    }
    
    return {
      cleaned: allCleaned,
      errors: allErrors,
      success: allErrors.length === 0
    };
  }
  
  /**
   * Updates Claude configuration in an environment
   * REQ-201: Configuration management
   */
  async updateClaudeConfig(
    environmentId: TestEnvironmentId,
    config: Record<string, unknown>
  ): Promise<void> {
    const environment = this.getEnvironment(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`) as E2EError;
    }
    
    try {
      await fs.writeFile(
        environment.claudeConfigPath,
        JSON.stringify(config, null, 2)
      );
    } catch (error) {
      throw new Error(`Failed to update Claude config: ${error instanceof Error ? error.message : String(error)}`) as E2EError;
    }
  }
  
  /**
   * Reads Claude configuration from an environment
   * REQ-201: Configuration access
   */
  async readClaudeConfig(environmentId: TestEnvironmentId): Promise<Record<string, unknown>> {
    const environment = this.getEnvironment(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`) as E2EError;
    }
    
    try {
      const configData = await fs.readFile(environment.claudeConfigPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to read Claude config: ${error instanceof Error ? error.message : String(error)}`) as E2EError;
    }
  }
  
  /**
   * Validates environment integrity
   * REQ-205: Environment validation
   */
  async validateEnvironment(environmentId: TestEnvironmentId): Promise<{
    readonly valid: boolean;
    readonly issues: readonly string[];
  }> {
    const environment = this.getEnvironment(environmentId);
    const issues: string[] = [];
    
    if (!environment) {
      return {
        valid: false,
        issues: [`Environment ${environmentId} not found`]
      };
    }
    
    // Check temp directory exists
    try {
      await fs.access(environment.tempDir);
    } catch {
      issues.push(`Temp directory ${environment.tempDir} does not exist`);
    }
    
    // Check Claude config directory exists
    try {
      await fs.access(path.dirname(environment.claudeConfigPath));
    } catch {
      issues.push(`Claude config directory does not exist`);
    }
    
    // Check Claude config file exists and is valid JSON
    try {
      const configData = await fs.readFile(environment.claudeConfigPath, 'utf8');
      JSON.parse(configData);
    } catch {
      issues.push(`Claude config file is missing or invalid`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Singleton instance for global use
export const environmentManager = new E2EEnvironmentManager();

/**
 * Helper function to create a standard test environment
 * REQ-201: Simplified environment creation
 */
export async function createStandardTestEnvironment(): Promise<E2EEnvironment> {
  return environmentManager.createEnvironment({
    prefix: 'claude-test-standard-',
    createClaudeConfig: true
  });
}

/**
 * Helper function to create an environment with specific MCP servers
 * REQ-201: Customized environment creation
 */
export async function createCustomTestEnvironment(
  mcpServers: Record<string, unknown>
): Promise<E2EEnvironment> {
  return environmentManager.createEnvironment({
    prefix: 'claude-test-custom-',
    mcpServers,
    createClaudeConfig: true
  });
}

/**
 * Validates that the host system meets requirements for E2E testing
 * REQ-201: System requirements validation
 */
export async function validateSystemRequirements(): Promise<{
  readonly valid: boolean;
  readonly requirements: readonly {
    readonly name: string;
    readonly met: boolean;
    readonly details: string;
  }[];
}> {
  const requirements = [];
  
  // Check Node.js version
  const nodeVersion = process.version;
  const nodeVersionValid = parseInt(nodeVersion.substring(1)) >= 18;
  requirements.push({
    name: 'Node.js >= 18',
    met: nodeVersionValid,
    details: `Current version: ${nodeVersion}`
  });
  
  // Check npm availability
  let npmAvailable = false;
  try {
    const { execSync } = require('child_process');
    execSync('npm --version', { stdio: 'ignore' });
    npmAvailable = true;
  } catch {
    npmAvailable = false;
  }
  requirements.push({
    name: 'npm available',
    met: npmAvailable,
    details: npmAvailable ? 'npm found in PATH' : 'npm not found in PATH'
  });
  
  // Check temp directory access
  let tempDirWritable = false;
  try {
    const testFile = path.join(os.tmpdir(), `test-${Date.now()}`);
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    tempDirWritable = true;
  } catch {
    tempDirWritable = false;
  }
  requirements.push({
    name: 'Temp directory writable',
    met: tempDirWritable,
    details: tempDirWritable ? 'Can write to temp directory' : 'Cannot write to temp directory'
  });
  
  // Check current directory access
  let cwdWritable = false;
  try {
    const testFile = path.join(process.cwd(), `.test-${Date.now()}`);
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    cwdWritable = true;
  } catch {
    cwdWritable = false;
  }
  requirements.push({
    name: 'Current directory writable',
    met: cwdWritable,
    details: cwdWritable ? 'Can write to current directory' : 'Cannot write to current directory'
  });
  
  const allMet = requirements.every(req => req.met);
  
  return {
    valid: allMet,
    requirements
  };
}

/**
 * Sets up a test environment for a specific test suite
 * REQ-201: Test suite environment setup
 */
export async function setupTestSuite(suiteName: string): Promise<{
  readonly environment: E2EEnvironment;
  readonly cleanup: () => Promise<CleanupResult>;
}> {
  const environment = await environmentManager.createEnvironment({
    prefix: `claude-test-${suiteName}-`
  });
  
  const cleanup = async (): Promise<CleanupResult> => {
    return environmentManager.destroyEnvironment(environment.id);
  };
  
  return {
    environment,
    cleanup
  };
}