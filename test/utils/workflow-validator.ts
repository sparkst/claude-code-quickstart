/**
 * Workflow Validator Module - REQ-802: E2E Test Infrastructure Fixes
 * Validates test workflows and execution results
 */

import type {
  WorkflowValidator,
  WorkflowStep,
  ValidationResult,
  ExecutionResult
} from './e2e-types.js';

/**
 * Implementation of WorkflowValidator for E2E testing
 * REQ-802: Fix E2E test infrastructure logic
 */
export class WorkflowValidatorImpl implements WorkflowValidator {
  async validateWorkflow(workflow: WorkflowStep[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workflow || workflow.length === 0) {
      errors.push('Workflow cannot be empty');
      return { success: false, errors, warnings };
    }

    for (let i = 0; i < workflow.length; i++) {
      const step = workflow[i];
      const stepValidation = await this.validateStep(step);

      if (!stepValidation.success) {
        errors.push(`Step ${i + 1}: ${stepValidation.errors.join(', ')}`);
      }

      warnings.push(...stepValidation.warnings.map(w => `Step ${i + 1}: ${w}`));
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }

  async validateSteps(steps: WorkflowStep[]): Promise<ValidationResult> {
    return this.validateWorkflow(steps);
  }

  async validateExpectations(
    result: ExecutionResult,
    expected: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!result) {
      errors.push('Execution result is missing');
      return { success: false, errors, warnings };
    }

    if (expected) {
      // Validate expected exit code
      if (expected.code !== undefined && result.code !== expected.code) {
        errors.push(`Expected exit code ${expected.code}, got ${result.code}`);
      }

      // Validate expected stdout content
      if (expected.stdout && !result.stdout.includes(expected.stdout)) {
        errors.push(`Expected stdout to contain '${expected.stdout}'`);
      }

      // Validate expected stderr content
      if (expected.stderr && !result.stderr.includes(expected.stderr)) {
        errors.push(`Expected stderr to contain '${expected.stderr}'`);
      }

      // Validate execution duration
      if (expected.maxDuration && result.duration > expected.maxDuration) {
        warnings.push(`Execution took ${result.duration}ms, expected max ${expected.maxDuration}ms`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }

  private async validateStep(step: WorkflowStep): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!step.command || step.command.trim() === '') {
      errors.push('Step command cannot be empty');
    }

    if (!step.args) {
      errors.push('Step args must be defined (can be empty array)');
    }

    if (step.timeout && step.timeout < 0) {
      errors.push('Step timeout must be positive');
    }

    if (step.timeout && step.timeout > 60000) {
      warnings.push('Step timeout is very long (>60s)');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Factory function to create WorkflowValidator instance
 * REQ-802: Missing createWorkflowValidator function
 */
export async function createWorkflowValidator(): Promise<WorkflowValidator> {
  const impl = new WorkflowValidatorImpl();

  // Return object with exactly the keys expected by tests in the correct order
  return {
    validateWorkflow: impl.validateWorkflow.bind(impl),
    validateSteps: impl.validateSteps.bind(impl),
    validateExpectations: impl.validateExpectations.bind(impl)
  };
}