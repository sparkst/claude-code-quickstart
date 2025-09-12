/**
 * TypeScript interfaces for E2E Testing Infrastructure
 * REQ-200: TypeScript Migration - Core type definitions
 */

// Branded types for type safety (CLAUDE.md C-3)
export type WorkflowStepId = string & { readonly brand: unique symbol };
export type TestEnvironmentId = string & { readonly brand: unique symbol };
export type ProcessId = number & { readonly brand: unique symbol };

// Core E2E Testing Types
export interface WorkflowStep {
  readonly id: WorkflowStepId;
  readonly name: string;
  readonly args: readonly string[];
  readonly expectedOutput?: string;
  readonly expectedError?: string;
  readonly expectSuccess?: boolean;
  readonly timeout?: number;
  readonly input?: string;
  readonly env?: Record<string, string>;
}

export interface WorkflowResult {
  readonly success: boolean;
  readonly results: readonly StepResult[];
  readonly completedSteps: number;
  readonly duration: number;
  readonly totalDuration: number;
  readonly environment: TestEnvironmentId;
}

export interface StepResult {
  readonly step: string;
  readonly command: readonly string[];
  readonly result: CommandResult;
  readonly duration: number;
  readonly success: boolean;
}

export interface CommandResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

// System Integration Types
export interface SystemIntegrationConfig {
  readonly system: 'macOS-filesystem' | 'npm-ecosystem' | 'claude-desktop';
  readonly tests: readonly string[];
}

export interface SystemIntegrationResult {
  macOSIntegration: TestComponentResult | null;
  npmEcosystem: TestComponentResult | null;
  claudeDesktopCompat: TestComponentResult | null;
  fileSystemPermissions: TestComponentResult | null;
  success: boolean;
  allTestsPassed: boolean;
  permissionIssues: readonly string[];
  platformCompatibility: string;
  npmCompatibility: boolean;
  globalInstallWorks: boolean;
  configCompatibility: string;
}

export interface TestComponentResult {
  readonly success: boolean;
  readonly error?: string;
  readonly [key: string]: unknown;
}

// User Interaction Types
export interface UserInteractionConfig {
  readonly userType: 'first-time' | 'experienced' | 'migrating' | 'existing-user';
  readonly scenario: string;
  readonly interactions?: readonly UserInteraction[];
}

export interface UserInteraction {
  readonly step: string;
  readonly input: string | readonly string[];
  readonly expectSuccess?: boolean;
}

export interface UserInteractionResult {
  readonly userType: string;
  readonly scenario: string;
  readonly interactions: readonly InteractionResult[];
  readonly success: boolean;
  readonly timing: TimingInfo;
  readonly setupSteps: number;
  readonly configurationSuccess: boolean;
  readonly userSatisfaction: number | string;
  readonly completed: boolean;
  readonly timeToComplete: number;
  readonly configurationEfficiency: number;
  readonly configComplexity?: string;
  readonly errorsEncountered?: number;
  readonly backupCreated?: boolean;
  readonly configMerged?: boolean;
}

export interface InteractionResult {
  readonly action: string;
  readonly success: boolean;
  readonly duration: number;
  readonly output: string;
  readonly errors?: string;
}

export interface TimingInfo {
  readonly total: number;
  readonly averageResponseTime: number;
}

// Workflow Scenario Types
export interface WorkflowScenarioConfig {
  readonly scenario: string;
  readonly steps?: readonly WorkflowStep[];
  readonly layers?: Record<string, LayerLimits>;
  readonly users?: readonly string[];
  readonly operations?: readonly string[];
}

export interface LayerLimits {
  readonly maxDuration: number;
  readonly tests: readonly string[];
}

export interface WorkflowScenarioResult {
  readonly success: boolean;
  readonly scenario: string;
  readonly layerIntegration?: string;
  readonly totalCoverage?: number;
  readonly completedSteps?: number;
  readonly userExperience?: string;
  readonly collaborationEfficiency?: number;
  readonly configConsistency?: string;
  readonly backupCreated?: boolean;
  readonly rollbackTested?: boolean;
  readonly dataIntegrity?: string;
  readonly testCoverage?: number;
  readonly chainIntegration?: string;
  readonly allLayersPassed?: boolean;
  readonly [key: string]: unknown;
}

// Environment Management Types
export interface E2EEnvironment {
  readonly id: TestEnvironmentId;
  readonly tempDir: string;
  readonly claudeConfigPath: string;
  readonly cleanup: readonly (() => Promise<void>)[];
}

export interface CleanupResult {
  readonly cleaned: readonly string[];
  readonly errors: readonly string[];
  readonly success: boolean;
}

// Error Types
export interface E2EError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
}

// Security Types
export interface SecurityValidationResult {
  readonly inputSanitized: boolean;
  readonly pathValidated: boolean;
  readonly envVarsSafe: boolean;
  readonly noInjectionVulnerabilities: boolean;
}

// Process Management Types
export interface ProcessInfo {
  readonly pid: ProcessId;
  readonly command: string;
  readonly args: readonly string[];
  readonly startTime: number;
}

export interface ProcessResult {
  readonly success: boolean;
  readonly processInfo: ProcessInfo;
  readonly result: CommandResult;
  readonly duration: number;
}