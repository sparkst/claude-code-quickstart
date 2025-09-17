/**
 * User Simulator Module - REQ-802: E2E Test Infrastructure Fixes
 * Simulates user interactions for E2E testing
 */

import type {
  UserSimulator,
  UserAction
} from './e2e-types.js';

/**
 * Implementation of UserSimulator for E2E testing
 * REQ-802: Fix E2E test infrastructure logic
 */
export class UserSimulatorImpl implements UserSimulator {
  private inputBuffer: string = '';
  private keySequence: string[] = [];

  async simulateInput(input: string): Promise<void> {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    this.inputBuffer += input;

    // Simulate input delay for more realistic testing
    await this.delay(Math.random() * 50 + 10);
  }

  async simulateKeypress(key: string): Promise<void> {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }

    this.keySequence.push(key);

    // Simulate keypress delay
    await this.delay(Math.random() * 20 + 5);
  }

  async simulateInteraction(action: UserAction): Promise<void> {
    const { type, value, timeout = 1000 } = action;

    switch (type) {
      case 'input':
        await this.simulateInput(value);
        break;

      case 'keypress':
        await this.simulateKeypress(value);
        break;

      case 'select':
        await this.simulateSelection(value);
        break;

      case 'confirm':
        await this.simulateConfirmation(value === 'true' || value === 'yes');
        break;

      default:
        throw new Error(`Unknown action type: ${type}`);
    }

    // Respect timeout if specified
    if (timeout > 0) {
      await this.delay(Math.min(timeout, 100)); // Cap delay for tests
    }
  }

  private async simulateSelection(option: string): Promise<void> {
    this.keySequence.push(`SELECT:${option}`);
    await this.delay(25);
  }

  private async simulateConfirmation(confirmed: boolean): Promise<void> {
    this.keySequence.push(confirmed ? 'CONFIRM:YES' : 'CONFIRM:NO');
    await this.delay(25);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper methods for testing
  getInputBuffer(): string {
    return this.inputBuffer;
  }

  getKeySequence(): readonly string[] {
    return [...this.keySequence];
  }

  clearBuffer(): void {
    this.inputBuffer = '';
    this.keySequence = [];
  }
}

/**
 * Factory function to create UserSimulator instance
 * REQ-802: Missing createUserSimulator function
 */
export async function createUserSimulator(): Promise<UserSimulator> {
  return new UserSimulatorImpl();
}