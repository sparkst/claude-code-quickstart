# Current Requirements: NPM Package Distribution Debug Plan

## REQ-101: Circular Dependency Resolution
- **Acceptance:** Remove self-referencing dependency from package.json that causes npm install to fail
- **Issue:** Package depends on itself via `"claude-code-quickstart": "file:claude-code-quickstart-1.0.2.tgz"`
- **Root Cause:** Line 52 in package.json creates circular dependency loop

## REQ-102: Package Registry Integrity Analysis
- **Acceptance:** Verify published package versions match expected content and resolve version mismatch (v1.1.0 vs v1.0.2)
- **Investigation Areas:**
  - npm registry data validation
  - Tarball content verification
  - Published version consistency check

## REQ-103: Local npm Environment Diagnosis
- **Acceptance:** Identify and resolve npm cache corruption and installation path issues
- **Investigation Areas:**
  - npm cache state analysis
  - node_modules structure validation
  - npm configuration conflicts
  - Homebrew node installation conflicts

## REQ-104: Package Build Process Validation
- **Acceptance:** Ensure package.json files array correctly includes all necessary distribution files
- **Investigation Areas:**
  - Verify `bin/`, `templates/`, `scripts/` inclusion
  - Check tarball generation process
  - Validate package structure matches distribution needs

## REQ-105: Installation Process Debugging
- **Acceptance:** Create comprehensive fix recommendations with alternative installation methods
- **Investigation Areas:**
  - npm install flow analysis
  - Test local vs global installation
  - Validate postinstall script execution
  - Document working installation procedure

## REQ-106: Version Management Fix
- **Acceptance:** Establish proper version management to prevent future v1.1.0 vs v1.0.2 conflicts
- **Investigation Areas:**
  - npm publish process validation
  - Version tag consistency
  - Release workflow optimization