/**
 * Workflow Validator Module - Validates test workflow steps for security and safety
 * REQ-710: Missing workflow validator infrastructure
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";

/**
 * Creates a workflow validator that validates individual steps and complete workflows
 * REQ-710: Missing createWorkflowValidator function
 */
export function createWorkflowValidator() {
  // Security constraints - dangerous commands and patterns
  const DANGEROUS_COMMANDS = [
    "rm",
    "del",
    "format",
    "fdisk",
    "mkfs",
    "dd",
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "chmod",
    "chown",
    "passwd",
    "su",
    "sudo",
  ];

  const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+[\/\\]/, // rm -rf / or \
    />\s*\/dev\/sd[a-z]/, // writing to disk devices
    /curl.*\|\s*sh/, // downloading and executing
    /wget.*\|\s*sh/, // downloading and executing
    /eval.*\$\(/, // eval with command substitution
    /system\s*\(/, // direct system calls
    /exec\s*\(/, // exec calls
    /require.*child_process/, // Node.js child_process
    /\$\(.*rm.*\)/, // command substitution with rm
    /.*\&\&.*rm/, // chained commands with rm
  ];

  /**
   * Validates a single workflow step for security and safety
   * @param {import('./e2e-types.js').WorkflowStep} step - The workflow step to validate
   * @returns {Promise<boolean>} - True if step is safe, false otherwise
   */
  async function validateStep(step) {
    if (!step || typeof step !== "object") {
      return false;
    }

    if (!step.command || typeof step.command !== "string") {
      return false;
    }

    // Check for dangerous commands
    if (DANGEROUS_COMMANDS.includes(step.command.toLowerCase())) {
      return false;
    }

    // Check for dangerous patterns in command and args
    const fullCommand = [step.command, ...(step.args || [])].join(" ");

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(fullCommand)) {
        return false;
      }
    }

    // Check if command exists (basic validation)
    try {
      await checkCommandExists(step.command);
      return true;
    } catch (error) {
      // Command doesn't exist or isn't accessible
      return false;
    }
  }

  /**
   * Validates a complete workflow sequence
   * @param {import('./e2e-types.js').WorkflowStep[]} workflow - Array of workflow steps
   * @returns {Promise<boolean>} - True if all steps are valid, false otherwise
   */
  async function validateComplete(workflow) {
    if (!Array.isArray(workflow)) {
      return false;
    }

    // Empty workflow is valid
    if (workflow.length === 0) {
      return true;
    }

    // Validate each step
    for (const step of workflow) {
      const isValid = await validateStep(step);
      if (!isValid) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if a command exists in the system PATH
   * @param {string} command - Command to check
   * @returns {Promise<void>} - Resolves if command exists, rejects otherwise
   */
  function checkCommandExists(command) {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === "win32";
      const testCommand = isWindows ? "where" : "which";

      const child = spawn(testCommand, [command], {
        stdio: "ignore",
        timeout: 5000,
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command '${command}' not found`));
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  return {
    validateStep,
    validateComplete,
  };
}

/**
 * Utility function to validate workflow step structure
 * @param {any} step - Object to validate
 * @returns {boolean} - True if step has required structure
 */
export function isValidWorkflowStepStructure(step) {
  return (
    step &&
    typeof step === "object" &&
    typeof step.command === "string" &&
    step.command.length > 0 &&
    Array.isArray(step.args || [])
  );
}
