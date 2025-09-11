/**
 * Test Constants - Parameterized values to replace hardcoded literals
 * Following CLAUDE.md Testing Best Practice #1: "SHOULD parameterize inputs; never embed unexplained literals"
 */

// Performance thresholds based on CLI responsiveness requirements
export const PERFORMANCE_THRESHOLDS = {
  // CLI startup must be responsive for developer workflow
  STARTUP_TIME_MS: 500,
  STARTUP_MAX_TIME_MS: 750,
  
  // Config operations should be near-instantaneous
  CONFIG_PARSE_TIME_MS: 100,
  CONFIG_WRITE_TIME_MS: 200,
  
  // File operations reasonable for typical project sizes
  FILE_READ_TIME_MS: 150,
  FILE_WRITE_TIME_MS: 250,
  
  // Memory usage limits for CLI tool
  MEMORY_LIMIT_MB: 50,
  MEMORY_GROWTH_LIMIT_MB: 10
};

// Test execution parameters
export const TEST_EXECUTION = {
  PERFORMANCE_ITERATIONS: 5,
  WARMUP_TIME_MS: 300,
  TIMEOUT_MS: 5000,
  TREND_DELAY_MS: 50
};

// Test naming and prefixes
export const TEST_PREFIX = 'claude-test';

// macOS-specific paths and behaviors
export const MACOS_PATHS = {
  HOME_DIR: '/Users/test-user',
  CLAUDE_CONFIG_DIR: '.claude',
  TEMP_DIR_PREFIX: 'claude-test',
  GLOBAL_NODE_MODULES: '/usr/local/lib/node_modules'
};

// MCP Server configurations for testing
export const MCP_SERVER_CONFIGS = {
  GITHUB: {
    name: 'github',
    command: 'npx',
    args: ['@modelcontextprotocol/server-github']
  },
  BRAVE_SEARCH: {
    name: 'brave-search',
    command: 'npx',
    args: ['@brave/brave-search-mcp-server', '--transport', 'stdio']
  },
  TAVILY: {
    name: 'tavily',
    command: 'npx',
    args: ['tavily-mcp']
  }
};

// Test environment variables (clearly marked as fake)
export const TEST_ENV_VARS = {
  GITHUB_TOKEN: 'fake-github-token-for-testing-only',
  BRAVE_API_KEY: 'fake-brave-key-for-testing-only',
  TAVILY_API_KEY: 'fake-tavily-key-for-testing-only'
};

// File permission constants for macOS testing
export const MACOS_PERMISSIONS = {
  READ_ONLY: 0o444,
  READ_WRITE: 0o644,
  EXECUTABLE: 0o755,
  NO_ACCESS: 0o000
};

// Error message patterns for validation
export const ERROR_PATTERNS = {
  NETWORK_ERROR: /network|connection|timeout/i,
  PERMISSION_ERROR: /permission|access|denied/i,
  FILE_NOT_FOUND: /not found|enoent/i,
  INVALID_CONFIG: /invalid|malformed|parse/i
};

// Test data generators
export const TEST_DATA = {
  VALID_CONFIG: {
    mcpServers: {
      github: MCP_SERVER_CONFIGS.GITHUB
    }
  },
  INVALID_CONFIG: '{ invalid json',
  EMPTY_CONFIG: '{}',
  LARGE_CONFIG_SIZE: 1024 * 10 // 10KB for performance testing
};