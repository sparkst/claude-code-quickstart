# CI/CD Guide

## Overview

This document provides comprehensive guidance for our GitHub Actions CI/CD pipeline, designed with macOS-only focus and robust testing infrastructure.

## 📋 Quick Reference

### Local Development Commands
```bash
# Comprehensive CI validation (matches GitHub Actions)
npm run ci:validate

# Quick local validation  
npm run ci:local

# Pre-commit validation
npm run pre-commit
```

### Pipeline Status
- **Main CI/CD Pipeline**: `.github/workflows/ci.yml`
- **PR Validation**: `.github/workflows/pr-validation.yml` 
- **Dependency Management**: `.github/dependabot.yml`
- **Issue Templates**: `.github/ISSUE_TEMPLATE/ci-cd-failure.yml`

## 🏗️ Architecture

Our CI/CD system implements a **multi-layered validation approach** following REQ-109 through REQ-112:

### REQ-109: Robust GitHub CI/CD Pipeline
- **macOS-only execution** on `macos-latest` runners
- **Node.js version matrix**: 18.x, 20.x, 22.x
- **Progressive quality gates**: format → lint → security → test → deploy
- **Artifact collection** for debugging and analysis

### REQ-110: CI/CD Testing and Validation Infrastructure
- **Multi-Node.js validation** across all supported versions
- **TDD-aware test execution** (recognizes intentional TODO failures)
- **Performance impact analysis** for PRs
- **Local validation tools** matching CI environment

### REQ-111: CI/CD Monitoring and Alerting System
- **Pipeline health monitoring** with execution time tracking
- **Automated issue creation** for failures
- **Performance regression detection**
- **Comprehensive reporting** with GitHub summaries

### REQ-112: CI/CD Security and Compliance
- **Multi-layered security scanning**: SAST, dependency audit, secret detection
- **Supply chain security** validation
- **License compliance** checking
- **Automated dependency management** via Dependabot

## 🚀 Workflows

### Main CI/CD Pipeline (`ci.yml`)

Triggers:
- Push to `main` branch
- Tags starting with `v*`
- Pull requests to `main`
- Manual workflow dispatch

**Jobs:**

1. **Quality Gates** (Node.js 18.x, 20.x, 22.x)
   - Code formatting validation
   - Linting with ESLint
   - Security dependency audit
   - License compliance checking
   - Test execution with coverage
   - Package integrity validation

2. **Progressive Tests** (Node.js 20.x)
   - Unit test execution
   - Integration test validation
   - End-to-end test scenarios
   - Performance benchmarking

3. **Pipeline Health**
   - Metrics collection
   - Health report generation
   - Artifact upload for analysis

4. **Security & Compliance**
   - Secret scanning
   - Static application security testing (SAST)
   - Supply chain validation

5. **Deployment** (main branch only)
   - Package building
   - Pre-deployment validation
   - Dry-run deployment
   - Deployment record creation

6. **Notifications**
   - Status determination
   - Summary generation
   - Failure alerting

### PR Validation (`pr-validation.yml`)

Optimized for **fast feedback** on pull requests:

1. **PR Checks**
   - Quick format/lint validation
   - Fast security check
   - Test execution

2. **Performance Impact Analysis**
   - Benchmarks main vs PR branch
   - Performance regression detection

3. **PR Security Validation**
   - Sensitive change detection
   - Enhanced security audit

4. **PR Summary**
   - Validation results summary
   - Pass/fail status reporting

## 🛠️ Local Development

### Pre-commit Validation

Our pre-commit hook automatically runs:
```bash
./scripts/pre-commit-hook.sh
```

**Validation steps:**
1. Code formatting check (`npm run format:check`)
2. Linting validation (`npm run lint`) 
3. Quick test execution (with timeout)
4. Basic secret scanning

### Comprehensive Local Validation

The `scripts/ci-validation.js` script provides **complete local validation**:

```bash
npm run ci:validate
```

**Validation includes:**
- GitHub Actions workflow validation
- Package configuration checking
- Environment verification
- Quality gate execution
- Test infrastructure validation
- Security scanning

### Git Hooks Setup

Hooks are automatically configured via `package.json` prepare script:
```json
{
  "prepare": "command -v git >/dev/null 2>&1 && git config core.hooksPath .githooks || true"
}
```

## 📊 Monitoring and Alerting

### Pipeline Health Metrics

Our CI/CD system tracks:
- **Success rate** across all workflows
- **Execution time** and performance trends
- **Failure patterns** and common issues
- **Resource usage** and optimization opportunities

### Automated Issue Creation

Failed pipelines automatically generate issues using:
- `.github/ISSUE_TEMPLATE/ci-cd-failure.yml`
- **Structured failure reporting**
- **Priority classification**
- **Investigation checklists**

### Performance Monitoring

- **PR performance comparison** (main vs branch)
- **Regression detection** with historical baselines
- **Resource optimization** recommendations

## 🔒 Security

### Multi-layered Security Scanning

1. **SAST (Static Application Security Testing)**
   - ESLint security rules
   - Code pattern analysis

2. **Dependency Security**
   - `npm audit` with moderate threshold
   - Supply chain validation
   - License compliance verification

3. **Secret Detection**
   - Pattern-based scanning
   - Staged file analysis
   - CI/CD configuration protection

4. **Supply Chain Security**
   - Package signature validation
   - Integrity verification
   - Trusted registry validation

### Automated Dependency Management

Dependabot configuration:
- **Weekly updates** for npm dependencies
- **Grouped updates** by production/development
- **Security-first** update strategy
- **Automated PR creation** with testing

## 🚨 Troubleshooting

### Common Issues

**Q: Tests failing with TODO errors**
A: This is expected! Our TDD methodology creates intentional TODO failures to guide implementation.

**Q: Pipeline fails on specific Node.js version**
A: Check compatibility matrices and package.json engines specification.

**Q: Security audit failures**
A: Review `npm audit` output and update dependencies or add audit exceptions.

**Q: Performance regression detected**
A: Compare PR branch with main branch benchmarks and optimize bottlenecks.

### Debugging Tools

1. **Local CI Validation**
   ```bash
   npm run ci:validate
   ```

2.0 **Workflow Artifacts**
   - Test results and coverage reports
   - Pipeline health reports
   - Performance comparison data
   - Security scan results

3. **Issue Templates**
   - Structured failure reporting
   - Investigation checklists
   - Priority classification

### Getting Help

1. **Check existing issues** for similar problems
2. **Use issue templates** for consistent reporting  
3. **Include pipeline run URLs** and error logs
4. **Run local validation** before reporting

## 📈 Optimization

### Performance Best Practices

- **Parallel job execution** where possible
- **Artifact caching** for dependencies
- **Targeted testing** based on changed files
- **Resource optimization** for faster builds

### Cost Optimization

- **macOS-only execution** (no Windows/Ubuntu overhead)
- **Efficient Node.js version matrix**
- **Conditional job execution** based on changes
- **Artifact retention policies**

## 🔄 Maintenance

### Regular Maintenance Tasks

1. **Review Dependabot PRs** weekly
2. **Monitor pipeline health** metrics
3. **Update security scanning** rules
4. **Optimize performance** based on trends
5. **Review and update** documentation

### Updating CI/CD Configuration

1. **Test changes locally** first
2. **Use feature branches** for CI/CD updates
3. **Validate with PR pipeline** before merging
4. **Monitor for regressions** after deployment

---

## 🎯 Next Steps

This CI/CD system is **production-ready** and includes:

✅ **Comprehensive validation** with local tools  
✅ **Multi-layered security** scanning  
✅ **Performance monitoring** and regression detection  
✅ **Automated dependency** management  
✅ **Structured issue** reporting and tracking  

**To enable npm publishing:**
1. Add `NPM_TOKEN` secret to repository
2. Uncomment deployment steps in `ci.yml`
3. Configure production environment approvals

The system is designed to grow with your project while maintaining high reliability and security standards.