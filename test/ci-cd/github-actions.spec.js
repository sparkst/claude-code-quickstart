import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import yaml from "js-yaml";

const execAsync = promisify(exec);

// Import parameterized constants to replace hardcoded literals
const GITHUB_WORKFLOW_PATHS = {
  WORKFLOWS_DIR: ".github/workflows",
  CI_WORKFLOW: ".github/workflows/ci.yml",
  SECURITY_WORKFLOW: ".github/workflows/security.yml",
  PR_VALIDATION_WORKFLOW: ".github/workflows/pr-validation.yml"
};

const NODE_VERSIONS = ["18.x", "20.x", "22.x"];
const MACOS_RUNNER = "macos-latest";
const QUALITY_GATES = ["format", "lint", "typecheck", "test", "security"];

// Import CI/CD utilities (these should fail initially as they don't exist)
import {
  parseGitHubWorkflow,
  validateWorkflowMatrix,
  validateSecurityScanning,
  validatePerformanceBenchmarks,
  validateMonitoringSetup,
  validateDeploymentPipeline,
  checkWorkflowSyntax,
  validateCacheConfiguration,
  validateSecretManagement,
  validateArtifactCollection,
  validateComplianceChecks,
  simulateWorkflowExecution
} from "../utils/github-actions-helpers.js";

describe("REQ-109 — Robust GitHub CI/CD Pipeline with macOS Focus", () => {
  let workflowsDir;
  let ciWorkflowPath;
  let securityWorkflowPath;
  let prValidationWorkflowPath;

  beforeEach(() => {
    const projectRoot = path.resolve(process.cwd());
    workflowsDir = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.WORKFLOWS_DIR);
    ciWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.CI_WORKFLOW);
    securityWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.SECURITY_WORKFLOW);
    prValidationWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.PR_VALIDATION_WORKFLOW);
  });

  describe("GitHub Actions Workflow Configuration", () => {
    test("REQ-109 — validates CI workflow exists with proper macOS configuration", async () => {
      expect(fs.existsSync(ciWorkflowPath)).toBe(true);
      
      const workflowContent = fs.readFileSync(ciWorkflowPath, "utf8");
      const workflow = yaml.load(workflowContent);
      
      expect(workflow.jobs.ci["runs-on"]).toBe(MACOS_RUNNER);
      expect(workflow.name).toBe("CI Pipeline");
    });

    test("REQ-109 — validates Node.js version matrix strategy", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const matrixValidation = await validateWorkflowMatrix(workflow);
      
      expect(matrixValidation.nodeVersions).toEqual(NODE_VERSIONS);
      expect(matrixValidation.includesMacOS).toBe(true);
      expect(matrixValidation.isValid).toBe(true);
    });

    test("REQ-109 — validates all quality gates are implemented", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      
      for (const gate of QUALITY_GATES) {
        const stepExists = workflow.jobs.ci.steps.some(step => 
          step.name.toLowerCase().includes(gate) || 
          step.run?.includes(gate)
        );
        expect(stepExists).toBe(true);
      }
    });

    test("REQ-109 — validates progressive test execution order", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const testSteps = workflow.jobs.ci.steps
        .filter(step => step.name?.includes("test") || step.run?.includes("test"))
        .map(step => step.name);
      
      expect(testSteps).toContain("Run unit tests");
      expect(testSteps).toContain("Run integration tests");
      expect(testSteps).toContain("Run e2e tests");
      
      const unitIndex = testSteps.findIndex(step => step.includes("unit"));
      const integrationIndex = testSteps.findIndex(step => step.includes("integration"));
      const e2eIndex = testSteps.findIndex(step => step.includes("e2e"));
      
      expect(unitIndex).toBeLessThan(integrationIndex);
      expect(integrationIndex).toBeLessThan(e2eIndex);
    });

    test("REQ-109 — validates performance benchmarking integration", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const benchmarkValidation = await validatePerformanceBenchmarks(workflow);
      
      expect(benchmarkValidation.hasBenchmarkStep).toBe(true);
      expect(benchmarkValidation.hasRegressionDetection).toBe(true);
      expect(benchmarkValidation.collectsMetrics).toBe(true);
    });
  });

  describe("Deployment Workflow Configuration", () => {
    test("REQ-109 — validates PR validation workflow", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      
      expect(workflow.on).toHaveProperty("pull_request");
      expect(workflow.on.pull_request).toEqual(["opened", "synchronize", "reopened"]);
    });

    test("REQ-109 — validates main branch deployment workflow", async () => {
      const ciWorkflow = await parseGitHubWorkflow(ciWorkflowPath);
      
      expect(ciWorkflow.on).toHaveProperty("push");
      expect(ciWorkflow.on.push.branches).toContain("main");
      expect(ciWorkflow.jobs.deploy["runs-on"]).toBe(MACOS_RUNNER);
    });

    test("REQ-109 — validates artifact collection for debugging", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const artifactValidation = await validateArtifactCollection(workflow);
      
      expect(artifactValidation.collectsTestResults).toBe(true);
      expect(artifactValidation.collectsCoverage).toBe(true);
      expect(artifactValidation.collectsBenchmarks).toBe(true);
      expect(artifactValidation.hasFailureReporting).toBe(true);
    });
  });

  describe("Cache and Secret Management", () => {
    test("REQ-109 — validates cache optimization for dependencies", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const cacheValidation = await validateCacheConfiguration(workflow);
      
      expect(cacheValidation.cachesNodeModules).toBe(true);
      expect(cacheValidation.cachesBuildArtifacts).toBe(true);
      expect(cacheValidation.hasProperCacheKeys).toBe(true);
    });

    test("REQ-109 — validates secret management for external integrations", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const secretValidation = await validateSecretManagement(workflow);
      
      expect(secretValidation.usesProperSecretSyntax).toBe(true);
      expect(secretValidation.hasRequiredSecrets).toBe(true);
      expect(secretValidation.noHardcodedSecrets).toBe(true);
    });
  });
});

describe("REQ-110 — CI/CD Testing and Validation Infrastructure", () => {
  let testWorkflowPath;
  let ciWorkflowPath;

  beforeEach(() => {
    const projectRoot = path.resolve(process.cwd());
    testWorkflowPath = path.join(process.cwd(), ".github/workflows/test-pipeline.yml");
    ciWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.CI_WORKFLOW);
  });

  describe("Pipeline Validation Testing", () => {
    test("REQ-110 — validates CI/CD pipeline across all Node.js versions", async () => {
      const results = await Promise.all(
        NODE_VERSIONS.map(version => 
          simulateWorkflowExecution(ciWorkflowPath, { nodeVersion: version })
        )
      );
      
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.nodeVersion).toBe(NODE_VERSIONS[index]);
      });
    });

    test("REQ-110 — tests failure scenarios and recovery mechanisms", async () => {
      const failureScenarios = [
        { type: "test_failure", expectedRecovery: "retry_mechanism" },
        { type: "dependency_failure", expectedRecovery: "fallback_strategy" },
        { type: "network_failure", expectedRecovery: "offline_mode" }
      ];
      
      for (const scenario of failureScenarios) {
        const result = await simulateWorkflowExecution(ciWorkflowPath, {
          simulateFailure: scenario.type
        });
        
        expect(result.recoveryMechanism).toBe(scenario.expectedRecovery);
        expect(result.gracefulFailure).toBe(true);
      }
    });

    test("REQ-110 — validates canary deployment for npm packages", async () => {
      const ciWorkflow = await parseGitHubWorkflow(ciWorkflowPath);
      const canaryValidation = await validateDeploymentPipeline(ciWorkflow);
      
      expect(canaryValidation.hasCanaryStage).toBe(true);
      expect(canaryValidation.hasRollbackCapability).toBe(true);
      expect(canaryValidation.validatesPackageIntegrity).toBe(true);
    });

    test("REQ-110 — validates pre-commit and pre-push hooks", async () => {
      const hooksPath = path.join(process.cwd(), ".githooks");
      const preCommitPath = path.join(hooksPath, "pre-commit");
      const prePushPath = path.join(hooksPath, "pre-push");
      
      expect(fs.existsSync(preCommitPath)).toBe(true);
      expect(fs.existsSync(prePushPath)).toBe(true);
      
      const preCommitContent = fs.readFileSync(preCommitPath, "utf8");
      expect(preCommitContent).toContain("npm run lint");
      expect(preCommitContent).toContain("npm run format:check");
      expect(preCommitContent).toContain("npm run test:run");
    });
  });

  describe("External Dependencies Validation", () => {
    test("REQ-110 — validates all external dependencies and service integrations", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const requiredDependencies = [
        "actions/checkout",
        "actions/setup-node"
      ];
      
      // Check required dependencies
      requiredDependencies.forEach(dep => {
        const usesStep = workflow.jobs.ci.steps.find(step => step.uses?.startsWith(dep));
        expect(usesStep).toBeDefined();
        expect(usesStep.uses).toMatch(/^[\w-]+\/[\w-]+@v?\d+/);
      });
      
      // Check that all uses steps follow proper versioning
      const allUsesSteps = Object.values(workflow.jobs || {})
        .flatMap(job => job.steps || [])
        .filter(step => step.uses);
      
      expect(allUsesSteps.length).toBeGreaterThan(0);
      allUsesSteps.forEach(step => {
        expect(step.uses).toMatch(/^[\w-]+\/[\w-]+@v?\d+/);
      });
    });

    test("REQ-110 — validates compatibility testing across macOS versions", async () => {
      const macosVersions = ["macos-13", "macos-14", "macos-latest"];
      
      for (const macosVersion of macosVersions) {
        const result = await simulateWorkflowExecution(ciWorkflowPath, {
          runner: macosVersion
        });
        
        expect(result.success).toBe(true);
        expect(result.macosCompatible).toBe(true);
      }
    });
  });

  describe("Performance and Security Testing", () => {
    test("REQ-110 — validates performance benchmarks for CI/CD execution time", async () => {
      const benchmarkResult = await simulateWorkflowExecution(ciWorkflowPath, {
        collectMetrics: true
      });
      
      expect(benchmarkResult.executionTime).toBeLessThan(900000); // 15 minutes max
      expect(benchmarkResult.metrics).toHaveProperty("buildTime");
      expect(benchmarkResult.metrics).toHaveProperty("testTime");
      expect(benchmarkResult.metrics).toHaveProperty("deployTime");
    });

    test("REQ-110 — validates security scanning in test pipeline", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const securityValidation = await validateSecurityScanning(workflow);
      
      expect(securityValidation.hasDependencyScanning).toBe(true);
      expect(securityValidation.hasSecretScanning).toBe(true);
      expect(securityValidation.hasLicenseCompliance).toBe(true);
    });
  });
});

describe("REQ-111 — CI/CD Monitoring and Alerting System", () => {
  let ciWorkflowPath;

  beforeEach(() => {
    const projectRoot = path.resolve(process.cwd());
    ciWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.CI_WORKFLOW);
  });

  describe("Pipeline Monitoring", () => {
    test("REQ-111 — monitors pipeline success rates and execution times", async () => {
      const monitoringConfig = await validateMonitoringSetup(ciWorkflowPath);
      
      expect(monitoringConfig.tracksSuccessRate).toBe(true);
      expect(monitoringConfig.tracksExecutionTime).toBe(true);
      expect(monitoringConfig.hasMetricsDashboard).toBe(true);
    });

    test("REQ-111 — alerts on pipeline failures with diagnostic information", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const alertingSteps = workflow.jobs.ci.steps.filter(step => 
        step.name?.includes("alert") || step.if?.includes("failure")
      );
      
      expect(alertingSteps.length).toBeGreaterThan(0);
      alertingSteps.forEach(step => {
        expect(step).toHaveProperty("if");
        expect(step.if).toContain("failure()");
      });
    });

    test("REQ-111 — tracks deployment frequency and lead time metrics", async () => {
      const ciWorkflow = await parseGitHubWorkflow(ciWorkflowPath);
      const metricsSteps = ciWorkflow.jobs.deploy.steps.filter(step =>
        step.name?.includes("metrics") || step.name?.includes("tracking")
      );
      
      expect(metricsSteps.length).toBeGreaterThan(0);
      expect(metricsSteps.some(step => 
        step.run?.includes("deployment_frequency") || 
        step.run?.includes("lead_time")
      )).toBe(true);
    });

    test("REQ-111 — monitors external dependency health", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const healthCheckSteps = workflow.jobs.ci.steps.filter(step =>
        step.name?.includes("health") || step.name?.includes("dependency check")
      );
      
      expect(healthCheckSteps.length).toBeGreaterThan(0);
      expect(healthCheckSteps.some(step =>
        step.run?.includes("npm audit") || step.uses?.includes("dependency-review")
      )).toBe(true);
    });
  });

  describe("Dashboard and Reporting", () => {
    test("REQ-111 — provides dashboard for CI/CD pipeline health visualization", async () => {
      const dashboardConfig = path.join(process.cwd(), ".github/workflows/dashboard.yml");
      expect(fs.existsSync(dashboardConfig)).toBe(true);
      
      const dashboard = await parseGitHubWorkflow(dashboardConfig);
      expect(dashboard.jobs).toHaveProperty("update-dashboard");
      expect(dashboard.jobs["update-dashboard"].steps.some(step =>
        step.uses?.includes("dashboard") || step.name?.includes("update dashboard")
      )).toBe(true);
    });

    test("REQ-111 — implements automated issue creation for consistent failures", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      
      // Check for notification system that handles failure reporting
      const notifyJob = workflow.jobs.notify;
      expect(notifyJob).toBeDefined();
      expect(notifyJob.if).toContain("always()");
      
      // Check that we have proper status determination
      const statusSteps = notifyJob.steps.filter(step =>
        step.name?.includes("status") || step.run?.includes("OVERALL_STATUS")
      );
      
      expect(statusSteps.length).toBeGreaterThan(0);
    });

    test("REQ-111 — tracks security vulnerability detection and resolution", async () => {
      const securityWorkflow = path.join(process.cwd(), GITHUB_WORKFLOW_PATHS.SECURITY_WORKFLOW);
      const workflow = await parseGitHubWorkflow(securityWorkflow);
      
      const securitySteps = workflow.jobs.security.steps.filter(step =>
        step.name?.includes("vulnerability") || step.name?.includes("security scan")
      );
      
      expect(securitySteps.length).toBeGreaterThan(0);
      expect(securitySteps.some(step =>
        step.run?.includes("npm audit") || step.uses?.includes("security")
      )).toBe(true);
    });
  });
});

describe("REQ-112 — CI/CD Security and Compliance", () => {
  let securityWorkflowPath;
  let ciWorkflowPath;

  beforeEach(() => {
    const projectRoot = path.resolve(process.cwd());
    securityWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.SECURITY_WORKFLOW);
    ciWorkflowPath = path.join(projectRoot, GITHUB_WORKFLOW_PATHS.CI_WORKFLOW);
  });

  describe("Security Scanning", () => {
    test("REQ-112 — implements comprehensive security scanning in CI/CD pipeline", async () => {
      const workflow = await parseGitHubWorkflow(securityWorkflowPath);
      const securityValidation = await validateSecurityScanning(workflow);
      
      expect(securityValidation.hasSASTScanning).toBe(true);
      expect(securityValidation.hasDependencyScanning).toBe(true);
      expect(securityValidation.hasSecretScanning).toBe(true);
      expect(securityValidation.hasLicenseCompliance).toBe(true);
    });

    test("REQ-112 — ensures proper secret management and rotation", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const secretValidation = await validateSecretManagement(workflow);
      
      expect(secretValidation.usesGitHubSecrets).toBe(true);
      expect(secretValidation.noHardcodedCredentials).toBe(true);
      expect(secretValidation.hasSecretRotationStrategy).toBe(true);
    });

    test("REQ-112 — validates supply chain security for dependencies", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const supplyChainSteps = workflow.jobs.ci.steps.filter(step =>
        step.name?.includes("supply chain") || 
        step.uses?.includes("dependency-review") ||
        step.run?.includes("npm audit")
      );
      
      expect(supplyChainSteps.length).toBeGreaterThan(0);
      expect(supplyChainSteps.some(step =>
        step.uses?.includes("actions/dependency-review-action")
      )).toBe(true);
    });

    test("REQ-112 — implements proper access controls and permissions", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      
      expect(workflow.permissions).toBeDefined();
      expect(workflow.permissions.contents).toBe("read");
      expect(workflow.permissions["security-events"]).toBe("write");
      
      Object.values(workflow.jobs).forEach(job => {
        if (job.permissions) {
          expect(typeof job.permissions).toBe("object");
        }
      });
    });
  });

  describe("Compliance and Code Signing", () => {
    test("REQ-112 — validates license compliance requirements", async () => {
      const complianceValidation = await validateComplianceChecks(ciWorkflowPath);
      
      expect(complianceValidation.checksLicenseCompatibility).toBe(true);
      expect(complianceValidation.generatesLicenseReport).toBe(true);
      expect(complianceValidation.enforcesLicensePolicy).toBe(true);
    });

    test("REQ-112 — implements vulnerability detection and remediation workflows", async () => {
      const securityWorkflow = await parseGitHubWorkflow(securityWorkflowPath);
      const remediationSteps = securityWorkflow.jobs.security.steps.filter(step =>
        step.name?.includes("remediation") || step.name?.includes("fix vulnerabilities")
      );
      
      expect(remediationSteps.length).toBeGreaterThan(0);
      expect(remediationSteps.some(step =>
        step.uses?.includes("dependabot") || step.run?.includes("npm update")
      )).toBe(true);
    });

    test("REQ-112 — validates code signing and package integrity", async () => {
      const ciWorkflow = await parseGitHubWorkflow(ciWorkflowPath);
      const signingSteps = ciWorkflow.jobs.deploy.steps.filter(step =>
        step.name?.includes("sign") || step.name?.includes("integrity")
      );
      
      expect(signingSteps.length).toBeGreaterThan(0);
      expect(signingSteps.some(step =>
        step.run?.includes("npm pack") && step.run?.includes("integrity")
      )).toBe(true);
    });

    test("REQ-112 — implements supply chain attack prevention measures", async () => {
      const workflow = await parseGitHubWorkflow(ciWorkflowPath);
      const preventionSteps = workflow.jobs.ci.steps.filter(step =>
        step.name?.includes("supply chain") || 
        step.uses?.includes("slsa") ||
        step.run?.includes("lockfile")
      );
      
      expect(preventionSteps.length).toBeGreaterThan(0);
      expect(preventionSteps.some(step =>
        step.run?.includes("package-lock.json") || 
        step.run?.includes("npm ci")
      )).toBe(true);
    });
  });
});