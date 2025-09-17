/**
 * Test Helpers - Complete utility implementations to support TDD methodology
 *
 * Production-ready test utilities for MCP server testing, macOS integration,
 * and comprehensive test environment management.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { MACOS_PATHS, TEST_DATA } from './test-constants.js';

/**
 * Creates a temporary directory with specified prefix
 */
export async function createTempDirectory(prefix = MACOS_PATHS.TEMP_DIR_PREFIX, options = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix + '-'));

  // Create nested directory structure as expected by tests
  if (!options.createSubdirs || options.createSubdirs.includes('.claude')) {
    await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true });
  }
  if (!options.createSubdirs || options.createSubdirs.includes('node_modules')) {
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
  }
  if (!options.createSubdirs || options.createSubdirs.includes('src')) {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
  }

  return tempDir;
}

/**
 * Cleans up temporary directories
 */
export async function cleanupTempDirectory(dirPath) {
  if (!dirPath || (!dirPath.includes('tmp') && !dirPath.includes('test') && !dirPath.includes(os.tmpdir()))) {
    throw new Error('Safety check: Will only cleanup paths containing "tmp" or "test"');
  }

  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    // Directory might already be cleaned up
    return false;
  }
}

/**
 * Creates a mock MCP server configuration
 */
export function createMockMcpServer(serverName, config = {}) {
  const defaults = {
    command: config.command || 'npx',
    args: config.args || ['-y', `@${serverName}/mcp-server`],
    env: config.env || {},
    transport: config.transport || 'stdio'
  };

  // Handle SSE transport servers
  if (serverName.includes('cloudflare')) {
    return {
      transport: 'sse',
      url: `https://${serverName}.mcp.cloudflare.com/sse`,
      ...config
    };
  }

  // Handle npm package servers
  return {
    ...defaults,
    ...config
  };
}

/**
 * Generates test configuration with specified parameters
 */
export function generateTestConfig(options = {}) {
  // Handle server list from options
  let mcpServers = {};
  if (options.servers && Array.isArray(options.servers)) {
    for (const serverName of options.servers) {
      mcpServers[serverName] = createMockMcpServer(serverName);
    }
  } else if (options.mcpServers) {
    mcpServers = options.mcpServers;
  } else {
    mcpServers = {
      github: createMockMcpServer('github'),
      filesystem: createMockMcpServer('filesystem'),
      brave: createMockMcpServer('brave')
    };
  }

  const defaultConfig = {
    mcpServers,
    globalShortcut: options.globalShortcut || 'CommandOrControl+Shift+Space',
    allowedActions: options.allowedActions || [
      'read',
      'write',
      'create_directory',
      'list_directory'
    ],
    deniedActions: options.deniedActions || [
      'bash',
      'computer_20241022'
    ],
    permissions: options.permissions || {
      deny: [
        'Read(*.env)',
        'Read(**/*.key)'
      ],
      allow: [
        'Read(/**)'
      ]
    },
    rules: options.rules || [
      {
        action: 'deny',
        resources: ['bash', 'computer_20241022']
      },
      {
        action: 'allow',
        resources: ['read', 'write', 'create_directory', 'list_directory']
      }
    ],
    ...options
  };

  return defaultConfig;
}

/**
 * Creates macOS-specific test paths
 */
export function createMacOSTestPaths(baseDir = MACOS_PATHS.HOME_DIR) {
  const username = os.userInfo().username;
  const homeDir = baseDir.replace('~', `/Users/${username}`);

  return {
    home: homeDir,
    homeDir: homeDir,
    claude: path.join(homeDir, '.claude'),
    claudeDir: path.join(homeDir, '.claude'),
    settings: path.join(homeDir, '.claude', 'settings.json'),
    tempDir: os.tmpdir(),
    libraryDir: `/Users/${username}/Library`,
    globalNpmDir: `/Users/${username}/.npm-global`,
    npmGlobal: `/Users/${username}/.npm-global`,
    npmBinDir: `/Users/${username}/.npm-global/bin`,
    npmLibDir: `/Users/${username}/.npm-global/lib`,
    nodeModules: `/Users/${username}/.npm-global/node_modules`,
    resolveSymlinks: function(linkPath) {
      try {
        return path.resolve(linkPath);
      } catch {
        return linkPath;
      }
    }
  };
}

/**
 * Validates MCP server configuration structure
 */
export function validateMcpServerConfig(config, options = {}) {
  const errors = [];
  const platformWarnings = [];

  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { isValid: false, errors, platformWarnings };
  }

  // Check for required command (stdio transport default)
  if (!config.command) {
    errors.push('Missing required field: command');
  }

  // Check for required args
  if (!config.args || !Array.isArray(config.args)) {
    errors.push('Missing required field: args (must be array)');
  }

  // Validate environment variables
  if (config.env && typeof config.env !== 'object') {
    errors.push('env must be an object');
  }

  // Check for macOS-specific executables
  const platform = options.platform || process.platform;
  if (config.command && platform === 'darwin') {
    const macosExecutables = ['node', 'npm', 'npx', 'python3'];
    if (macosExecutables.includes(config.command) || config.command.startsWith('/usr/bin/') || config.command.startsWith('/usr/local/bin/')) {
      // Valid macOS executable path - no warnings
    } else {
      platformWarnings.push(`Command "${config.command}" may not be available on macOS`);
    }
  }

  // Validate SSE transport if specified
  if (config.transport === 'sse') {
    if (!config.url) {
      errors.push('SSE transport requires url');
    } else if (!config.url.startsWith('https://')) {
      errors.push('SSE URLs must use HTTPS');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    platformWarnings
  };
}

/**
 * Sets up test environment with specified options
 */
export async function setupTestEnvironment(options = {}) {
  const tempDir = await createTempDirectory('claude-test-');
  const testPaths = createMacOSTestPaths(tempDir);

  // Create test directories
  await fs.mkdir(testPaths.claude, { recursive: true });

  // Create test settings if requested
  if (options.createSettings !== false) {
    const testConfig = generateTestConfig(options.config || {});
    await fs.writeFile(testPaths.settings, JSON.stringify(testConfig, null, 2));
  }

  return {
    tempDir,
    paths: testPaths,
    cleanup: () => cleanupTempDirectory(tempDir)
  };
}

/**
 * Tears down test environment
 */
export async function teardownTestEnvironment(environment) {
  if (environment && environment.cleanup) {
    return await environment.cleanup();
  }
  return true;
}

/**
 * Creates test fixtures and data files
 */
export async function createTestFixtures(tempDir, scenario = 'basic', options = {}) {
  const fixtures = {
    claudeConfig: path.join(tempDir, 'settings.json'),
    packageJson: path.join(tempDir, 'package.json'),
    readmeFile: path.join(tempDir, 'README.md')
  };

  // Create realistic test configuration
  const testConfig = generateTestConfig(options);
  await fs.writeFile(fixtures.claudeConfig, JSON.stringify(testConfig, null, 2));

  // Create package.json
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for Claude Code',
    main: 'index.js'
  };
  await fs.writeFile(fixtures.packageJson, JSON.stringify(packageJson, null, 2));

  // Create README
  await fs.writeFile(fixtures.readmeFile, '# Test Project\n\nThis is a test project.');

  // Generate MCP configs based on scenario
  if (scenario === 'complex-multi-server' || options.multiServer) {
    fixtures.mcpConfigs = {
      filesystem: { serverType: 'filesystem', command: 'npx', args: ['@filesystem/mcp'] },
      api: { serverType: 'api', command: 'npx', args: ['@api/mcp'] },
      database: { serverType: 'database', command: 'npx', args: ['@database/mcp'] }
    };

    // Generate complex multi-server scenarios
    const complexConfig = generateTestConfig({
      mcpServers: {
        github: createMockMcpServer('github'),
        filesystem: createMockMcpServer('filesystem'),
        brave: createMockMcpServer('brave'),
        cloudflare: createMockMcpServer('cloudflare-bindings'),
        supabase: createMockMcpServer('supabase')
      }
    });
    fixtures.complexConfigFile = path.join(tempDir, 'complex-settings.json');
    await fs.writeFile(fixtures.complexConfigFile, JSON.stringify(complexConfig, null, 2));
  } else {
    fixtures.mcpConfigs = {
      github: { serverType: 'api', command: 'npx', args: ['@github/mcp'] }
    };
  }

  return fixtures;
}

/**
 * Mocks npm global installation on macOS
 */
export async function mockGlobalNpmInstall(tempDir, packageName, options = {}) {
  const paths = createMacOSTestPaths(tempDir);

  const mockInstall = {
    binPath: path.join(paths.npmBinDir, packageName),
    libPath: path.join(paths.npmLibDir, packageName),
    symlinkPath: path.join(paths.npmBinDir, `${packageName}-symlink`),
    modulePath: path.join(paths.nodeModules, packageName),
    packageJson: path.join(paths.nodeModules, packageName, 'package.json')
  };

  if (options.simulatePermissionError) {
    return {
      ...mockInstall,
      permissionError: true,
      fallbackPath: path.join(paths.homeDir, '.local', 'npm', packageName)
    };
  }

  // Create npm global directories
  await fs.mkdir(paths.npmGlobal, { recursive: true });
  await fs.mkdir(paths.npmBinDir, { recursive: true });
  await fs.mkdir(paths.npmLibDir, { recursive: true });
  await fs.mkdir(paths.nodeModules, { recursive: true });

  // Create mock installation files
  await fs.mkdir(mockInstall.modulePath, { recursive: true });
  await fs.mkdir(path.dirname(mockInstall.libPath), { recursive: true });

  await fs.writeFile(mockInstall.packageJson, JSON.stringify({
    name: packageName,
    version: '1.0.0',
    bin: { [packageName]: 'index.js' }
  }, null, 2));

  // Create mock binary and lib files
  await fs.writeFile(mockInstall.binPath, '#!/usr/bin/env node\nconsole.log("Mock CLI");');
  await fs.writeFile(mockInstall.libPath, 'module.exports = {};');
  await fs.chmod(mockInstall.binPath, 0o755);

  return mockInstall;
}