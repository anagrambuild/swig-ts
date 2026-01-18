/**
 * Tests for SpendController class
 *
 * Tests the SpendController utility for managing spending limits:
 * - Static factory methods
 * - Spend limit checks
 * - Recurring window handling
 */

import { SpendController } from '../../src/actions/control';

describe('SpendController', () => {
  // ============================================================================
  // Static factory methods
  // ============================================================================

  describe('SpendController.none()', () => {
    test('creates controller that disallows spending', () => {
      const controller = SpendController.none();
      expect(controller.isAllowed).toBe(false);
    });

    test('canSpend returns false', () => {
      const controller = SpendController.none();
      expect(controller.canSpend()).toBe(false);
    });

    test('canSpendMax returns false', () => {
      const controller = SpendController.none();
      expect(controller.canSpendMax()).toBe(false);
    });

    test('spendLimit returns 0', () => {
      const controller = SpendController.none();
      expect(controller.spendLimit).toBe(0n);
    });
  });

  describe('SpendController.max()', () => {
    test('creates controller that allows unlimited spending', () => {
      const controller = SpendController.max();
      expect(controller.isAllowed).toBe(true);
    });

    test('canSpendMax returns true', () => {
      const controller = SpendController.max();
      expect(controller.canSpendMax()).toBe(true);
    });

    test('spendLimit returns null (unlimited)', () => {
      const controller = SpendController.max();
      expect(controller.spendLimit).toBe(null);
    });

    test('canSpend returns true for any amount', () => {
      const controller = SpendController.max();
      expect(controller.canSpend()).toBe(true);
      expect(controller.canSpend(1_000_000_000_000n)).toBe(true);
    });
  });

  describe('SpendController.once()', () => {
    test('creates controller with one-time limit', () => {
      const amount = 1_000_000n;
      const controller = SpendController.once(amount);
      expect(controller.isAllowed).toBe(true);
    });

    test('spendLimit returns the set amount', () => {
      const amount = 1_000_000n;
      const controller = SpendController.once(amount);
      expect(controller.spendLimit).toBe(amount);
    });

    test('canSpendMax returns false', () => {
      const controller = SpendController.once(1_000_000n);
      expect(controller.canSpendMax()).toBe(false);
    });

    test('canSpend returns true for amount within limit', () => {
      const controller = SpendController.once(1_000_000n);
      expect(controller.canSpend(500_000n)).toBe(true);
    });

    test('canSpend returns true for exact limit amount', () => {
      const controller = SpendController.once(1_000_000n);
      expect(controller.canSpend(1_000_000n)).toBe(true);
    });

    test('canSpend returns false for amount exceeding limit', () => {
      const controller = SpendController.once(1_000_000n);
      expect(controller.canSpend(2_000_000n)).toBe(false);
    });
  });

  describe('SpendController.recurring()', () => {
    const recurringConfig = {
      amount: 1_000_000n,
      window: 100n,
      lastReset: 50n,
      recurringAmount: 1_000_000n,
    };

    test('creates controller with recurring limit', () => {
      const controller = SpendController.recurring(recurringConfig);
      expect(controller.isAllowed).toBe(true);
    });

    test('spendLimit returns current amount', () => {
      const controller = SpendController.recurring(recurringConfig);
      expect(controller.spendLimit).toBe(recurringConfig.amount);
    });

    test('window returns the window duration', () => {
      const controller = SpendController.recurring(recurringConfig);
      expect(controller.window).toBe(recurringConfig.window);
    });

    test('lastReset returns last reset time', () => {
      const controller = SpendController.recurring(recurringConfig);
      expect(controller.lastReset).toBe(recurringConfig.lastReset);
    });

    test('recurringLimit returns the recurring amount', () => {
      const controller = SpendController.recurring(recurringConfig);
      expect(controller.recurringLimit).toBe(recurringConfig.recurringAmount);
    });

    test('canSpend respects current amount limit', () => {
      const controller = SpendController.recurring({
        ...recurringConfig,
        amount: 500_000n, // current amount is reduced
      });
      expect(controller.canSpend(500_000n)).toBe(true);
      expect(controller.canSpend(1_000_000n)).toBe(false);
    });
  });

  // ============================================================================
  // canSpend method
  // ============================================================================

  describe('canSpend', () => {
    test('returns isAllowed when no amount specified', () => {
      const allowedController = SpendController.once(1_000_000n);
      const disallowedController = SpendController.none();

      expect(allowedController.canSpend()).toBe(true);
      expect(disallowedController.canSpend()).toBe(false);
    });

    test('checks within limits when amount specified', () => {
      const controller = SpendController.once(1_000_000n);

      expect(controller.canSpend(500_000n)).toBe(true);
      expect(controller.canSpend(1_000_000n)).toBe(true);
      expect(controller.canSpend(1_500_000n)).toBe(false);
    });

    test('always returns true for max controller with any amount', () => {
      const controller = SpendController.max();

      expect(controller.canSpend(1n)).toBe(true);
      expect(controller.canSpend(1_000_000_000_000_000n)).toBe(true);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe('Edge cases', () => {
    test('handles zero amount limit', () => {
      const controller = SpendController.once(0n);
      expect(controller.isAllowed).toBe(true);
      expect(controller.spendLimit).toBe(0n);
      expect(controller.canSpend(0n)).toBe(true);
      expect(controller.canSpend(1n)).toBe(false);
    });

    test('handles very large amounts', () => {
      const largeAmount = BigInt(Number.MAX_SAFE_INTEGER) * 1000n;
      const controller = SpendController.once(largeAmount);
      expect(controller.spendLimit).toBe(largeAmount);
      expect(controller.canSpend(largeAmount)).toBe(true);
    });
  });
});
