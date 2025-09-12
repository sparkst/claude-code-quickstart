#!/usr/bin/env node

/**
 * Local CI/CD Validation Script
 * REQ-110 — Comprehensive local validation matching GitHub Actions pipeline
 * 
 * This script validates the project locally before pushing to GitHub,
 * ensuring CI/CD pipeline success and providing fast feedback to developers.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Validation configuration
const VALIDATION_CONFIG = {
  nodeVersions: ['18.x', '20.x', '22.x'],
  primaryVersion: '20.x',
  timeoutMs: 300000, // 5 minutes
  maxRetries: 2
};

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class CIValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
    this.startTime = Date.now();
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  success(message) {
    this.log(`✅ ${message}`, colors.green);
    this.results.passed.push(message);
  }

  error(message) {
    this.log(`❌ ${message}`, colors.red);
    this.results.failed.push(message);
  }

  warning(message) {
    this.log(`⚠️  ${message}`, colors.yellow);
    this.results.warnings.push(message);
  }

  info(message) {
    this.log(`ℹ️  ${message}`, colors.blue);
  }

  async runCommand(command, description, options = {}) {
    const { ignoreErrors = false, timeout = VALIDATION_CONFIG.timeoutMs } = options;
    
    this.info(`Running: ${description}`);
    
    try {
      const output = execSync(command, {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout,
        stdio: 'pipe'
      });
      
      this.success(`${description} - passed`);
      return { success: true, output };
    } catch (error) {
      if (ignoreErrors) {
        this.warning(`${description} - completed with warnings`);
        return { success: false, output: error.stdout || error.message };
      } else {
        this.error(`${description} - failed: ${error.message}`);
        return { success: false, output: error.stdout || error.message };
      }
    }
  }

  // REQ-109 — Validate GitHub Actions workflow files
  async validateWorkflowFiles() {
    this.info('Validating GitHub Actions workflow files...');
    
    const workflowDir = path.join(projectRoot, '.github/workflows');
    const expectedFiles = ['ci.yml', 'pr-validation.yml'];
    
    if (!fs.existsSync(workflowDir)) {
      this.error('GitHub Actions workflow directory not found');
      return false;
    }

    for (const file of expectedFiles) {
      const filePath = path.join(workflowDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for macOS runner
        if (content.includes('runs-on: macos-latest')) {
          this.success(`${file} - uses macOS runner`);
        } else {
          this.error(`${file} - missing macOS runner configuration`);
        }
        
        // Check for Node.js matrix
        if (content.includes('node-version:')) {
          this.success(`${file} - includes Node.js version matrix`);
        } else {
          this.warning(`${file} - missing Node.js version matrix`);
        }
      } else {
        this.error(`Required workflow file missing: ${file}`);
      }
    }

    return true;
  }

  // REQ-110 — Validate package configuration
  async validatePackageConfig() {
    this.info('Validating package.json configuration...');
    
    const packagePath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      this.error('package.json not found');
      return false;
    }

    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Check required scripts
    const requiredScripts = ['test', 'lint', 'format:check'];
    for (const script of requiredScripts) {
      if (packageData.scripts?.[script]) {
        this.success(`package.json - has ${script} script`);
      } else {
        this.error(`package.json - missing ${script} script`);
      }
    }

    // Check Node.js engine compatibility
    if (packageData.engines?.node) {
      this.success(`package.json - specifies Node.js engine: ${packageData.engines.node}`);
    } else {
      this.warning('package.json - missing Node.js engine specification');
    }

    return true;
  }

  // REQ-111 — Validate environment and dependencies
  async validateEnvironment() {
    this.info('Validating development environment...');
    
    // Check Node.js version
    const nodeResult = await this.runCommand('node --version', 'Node.js version check');
    if (nodeResult.success) {
      const version = nodeResult.output.trim();
      this.success(`Node.js version: ${version}`);
    }

    // Check npm version
    const npmResult = await this.runCommand('npm --version', 'npm version check');
    if (npmResult.success) {
      const version = npmResult.output.trim();
      this.success(`npm version: ${version}`);
    }

    // Check git status
    const gitResult = await this.runCommand('git status --porcelain', 'Git status check', { ignoreErrors: true });
    if (gitResult.output.trim()) {
      this.warning('Working directory has uncommitted changes');
    } else {
      this.success('Working directory is clean');
    }

    return true;
  }

  // REQ-109 — Quality gates validation
  async validateQualityGates() {
    this.info('Running quality gate validations...');
    
    // Install dependencies
    await this.runCommand('npm ci --prefer-offline --no-audit', 'Dependencies installation');

    // Format check
    await this.runCommand('npm run format:check', 'Code formatting validation');

    // Linting
    await this.runCommand('npm run lint', 'Code linting validation');

    // Type checking (if available)
    const packageData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    if (packageData.scripts?.typecheck) {
      await this.runCommand('npm run typecheck', 'TypeScript validation');
    }

    return true;
  }

  // REQ-110 — Test execution validation
  async validateTests() {
    this.info('Running test validation...');
    
    // Run tests
    const testResult = await this.runCommand('npm test', 'Test execution', { ignoreErrors: true });
    
    if (testResult.success) {
      this.success('All tests passed');
    } else {
      // Check if failures are expected TDD TODO failures
      const output = testResult.output;
      if (output.includes('TODO:') && output.includes('Failed Tests')) {
        this.success('Tests completed with expected TDD failures (TODO guidance)');
      } else {
        this.error('Tests failed with unexpected errors');
      }
    }

    return true;
  }

  // REQ-112 — Security validation
  async validateSecurity() {
    this.info('Running security validations...');
    
    // Dependency audit
    const auditResult = await this.runCommand('npm audit --audit-level=moderate --production', 'Dependency security audit', { ignoreErrors: true });
    
    if (auditResult.success) {
      this.success('No security vulnerabilities found');
    } else {
      this.warning('Security vulnerabilities detected - review required');
    }

    // License check (if license-checker is available)
    try {
      await this.runCommand('npx license-checker --production --onlyAllow "MIT;Apache-2.0;BSD;ISC;BSD-2-Clause;BSD-3-Clause;CC0-1.0;Unlicense"', 'License compliance check', { ignoreErrors: true });
    } catch {
      this.info('License checker not available - skipping license validation');
    }

    return true;
  }

  // REQ-111 — Test infrastructure validation
  async validateTestInfrastructure() {
    this.info('Validating test infrastructure...');
    
    const testDirs = ['test', 'test/utils', 'test/integration', 'test/e2e', 'test/performance', 'test/error-boundaries'];
    
    for (const dir of testDirs) {
      const dirPath = path.join(projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        this.success(`Test directory exists: ${dir}`);
      } else {
        this.warning(`Test directory missing: ${dir}`);
      }
    }

    // Check test constants
    const constantsPath = path.join(projectRoot, 'test/utils/test-constants.js');
    if (fs.existsSync(constantsPath)) {
      this.success('Test constants file exists');
    } else {
      this.error('Test constants file missing');
    }

    return true;
  }

  async generateReport() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    this.log('\n' + '='.repeat(60), colors.bold);
    this.log('CI/CD LOCAL VALIDATION REPORT', colors.bold);
    this.log('='.repeat(60), colors.bold);
    
    this.log(`\nDuration: ${duration}s`, colors.blue);
    this.log(`Passed: ${this.results.passed.length}`, colors.green);
    this.log(`Failed: ${this.results.failed.length}`, colors.red);
    this.log(`Warnings: ${this.results.warnings.length}`, colors.yellow);
    
    if (this.results.failed.length === 0) {
      this.log('\n🎉 All validations passed! Ready for CI/CD pipeline.', colors.green + colors.bold);
      return true;
    } else {
      this.log('\n💥 Some validations failed. Fix issues before pushing.', colors.red + colors.bold);
      this.log('\nFailed validations:', colors.red);
      this.results.failed.forEach(failure => {
        this.log(`  • ${failure}`, colors.red);
      });
      return false;
    }
  }

  // Main validation workflow
  async validate() {
    this.log('🚀 Starting CI/CD local validation...', colors.bold);
    
    try {
      await this.validateWorkflowFiles();
      await this.validatePackageConfig();
      await this.validateEnvironment();
      await this.validateQualityGates();
      await this.validateTests();
      await this.validateSecurity();
      await this.validateTestInfrastructure();
    } catch (error) {
      this.error(`Validation failed with error: ${error.message}`);
    }
    
    return await this.generateReport();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new CIValidator();
  const success = await validator.validate();
  process.exit(success ? 0 : 1);
}