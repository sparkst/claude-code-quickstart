# CI/CD Pipeline

## Purpose
Comprehensive GitHub Actions-based CI/CD pipeline providing quality gates, security scanning, deployment automation, and monitoring for the Claude Code Quickstart project. Implements enterprise-grade practices with TDD-first methodology and progressive test architecture.

## Boundaries
- **In**: Automated testing, security scanning, quality gates, deployment coordination, monitoring
- **Out**: Manual testing, external infrastructure management, third-party service configuration

## Key Files
- `workflows/ci.yml` — Main CI pipeline with multi-Node.js matrix testing
- `workflows/security.yml` — Dedicated security scanning and compliance checks
- `workflows/dashboard.yml` — Pipeline health monitoring and metrics collection
- `workflows/pr-validation.yml` — Pull request specific validations
- `workflows/deploy.yml` — Production deployment workflow
- `workflows/release.yml` — Release management automation
- `../test/ci-cd/github-actions.spec.js` — Comprehensive test suite
- `../test/utils/github-actions-helpers.js` — Pipeline testing utilities
- `../.githooks/` — Git hooks for local validation

## Patterns

### Quality Gates Architecture
```yaml
# Progressive validation with proper dependency chains
ci → security-compliance → deploy → notify
```

### Multi-Node.js Matrix Testing
- **Node.js 18.x, 20.x, 22.x** on macOS-latest
- Fail-fast disabled for comprehensive coverage
- Caching enabled for npm dependencies

### Security-First Approach
- **SAST Analysis** — ESLint security rules
- **Dependency Audit** — npm audit with moderate threshold
- **Secret Scanning** — 8 pattern types with exclusion logic
- **License Compliance** — Approved license validation
- **Supply Chain Security** — Package signature verification

### TDD Integration
All workflows reference REQ IDs in job comments:
```yaml
# REQ-109 — Comprehensive CI/CD Pipeline with Quality Gates
# REQ-111 — CI/CD Pipeline Health Monitoring
# REQ-112 — Security and Compliance Validation
```

## Dependencies

### Upstream
- **Source Code** — Main project files and tests
- **Git Repository** — Branch protection and commit history
- **Package Configuration** — package.json and dependencies

### Downstream
- **npm Registry** — Package deployment target
- **GitHub Artifacts** — Test results and reports storage
- **GitHub Environments** — Production deployment controls

## Workflow Triggers

### Push Events
```yaml
on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
```

### Pull Request Events
```yaml
on:
  pull_request: [ opened, synchronize, reopened ]
```

### Scheduled Events
```yaml
schedule:
  - cron: '0 2 * * *'  # Daily security scans
  - cron: '0 * * * *'  # Hourly dashboard updates
```

### Manual Dispatch
```yaml
workflow_dispatch:
  inputs:
    deploy:
      description: 'Deploy to npm'
      type: boolean
```

## Security Configuration

### Permissions (Least Privilege)
```yaml
permissions:
  contents: read
  security-events: write
  issues: write
  pull-requests: read
```

### Secret Management
- **NODE_AUTH_TOKEN** — npm registry authentication
- **GitHub Secrets** — Proper `${{ secrets.NAME }}` syntax
- **Environment Protection** — Production environment gates

### Compliance Checks
- **License Validation** — MIT, Apache-2.0, BSD variants allowed
- **Dependency Review** — GitHub's supply chain security
- **Secret Pattern Detection** — 8 comprehensive regex patterns
- **SAST Integration** — Security-focused linting rules

## Monitoring & Observability

### Pipeline Health Dashboard
- **Success Rate Tracking** — 95% target threshold
- **Execution Time Monitoring** — 8-minute average target
- **Failure Pattern Analysis** — Categorized recovery mechanisms
- **Artifact Collection** — Test results, coverage reports, security scans

### Metrics Collection
```json
{
  "pipeline_status": "healthy",
  "success_rate": "95%",
  "avg_duration": "8 minutes",
  "builds_today": 12,
  "avg_test_time": "2.5 minutes"
}
```

### Alerting Strategy
- **GitHub Step Summary** — Automated pipeline reports
- **Artifact Retention** — 30-365 days based on artifact type
- **Notification Job** — Status aggregation across all pipeline stages

## Deployment Strategy

### Environment Gates
```yaml
environment: production
needs: [ci, security-compliance]
if: |
  success() && 
  (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))
```

### Pre-deployment Validation
- **Package Integrity** — `npm pack --dry-run`
- **Test Suite Execution** — Full test battery
- **Security Verification** — Complete security pipeline
- **Build Artifact Creation** — Deployment record generation

### Rollback Capabilities
- **Failure Detection** — Automated failure monitoring
- **Notification System** — Immediate failure alerting
- **Manual Intervention Points** — Environment protection rules

## Git Hooks Integration

### Pre-commit Hook
- **Format Validation** — Prettier compliance check
- **Linting** — ESLint validation
- **Quick Tests** — Subset execution for speed
- **Basic Secret Scan** — Simple pattern detection

### Pre-push Hook
- **Full Test Suite** — Complete test execution
- **Build Verification** — Package integrity check
- **Security Scan** — Comprehensive validation
- **Performance Check** — Regression detection

## Common Tasks

### "Add new security check"
1. Add step to `workflows/security.yml`
2. Update `validateSecurityScanning()` in test helpers
3. Add test case in `github-actions.spec.js`
4. Reference appropriate REQ ID in comments

### "Modify deployment strategy"
1. Update `workflows/deploy.yml` environment configuration
2. Adjust `validateDeploymentPipeline()` helper function  
3. Update deployment-related tests
4. Consider canary deployment patterns

### "Add new quality gate"
1. Add validation step to `workflows/ci.yml`
2. Update dependency chain in `needs:` arrays
3. Add corresponding test validation
4. Update monitoring dashboard metrics

## Gotchas

### macOS Runner Limitations
- **Git Secrets** — May not be pre-installed, requires fallback patterns
- **License Checker** — Use `npx` for consistent availability
- **npm audit signatures** — Not universally supported, use `|| echo` fallback

### Workflow Dependencies
- **Job Ordering** — Security must complete before deployment
- **Failure Propagation** — Use `if: success()` for strict gates
- **Matrix Strategy** — Disable `fail-fast` for comprehensive coverage

### Secret Management
- **Pattern Exclusions** — Exclude test/spec/mock files from secret scanning
- **Environment Variables** — Use GitHub environments for sensitive deployments
- **Dry-run Safety** — Always test with `--dry-run` before actual deployment

### Test Integration
- **REQ ID Traceability** — All workflow jobs must reference requirement IDs
- **Helper Function Updates** — Maintain test helpers in sync with workflow changes
- **Artifact Validation** — Ensure test artifacts are collected for debugging

## Performance Targets

- **CI Pipeline**: < 8 minutes average execution
- **Security Scan**: < 5 minutes completion time  
- **Deployment**: < 3 minutes end-to-end
- **Test Suite**: < 2.5 minutes execution time
- **Success Rate**: > 95% reliability target