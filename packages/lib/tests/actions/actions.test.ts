/**
 * Tests for Actions class
 *
 * Tests the Actions class methods for querying permissions:
 * - Root permissions
 * - Authority management
 * - Program permissions
 * - SOL spending
 * - Token spending
 */

import { Keypair } from '@solana/web3.js';
import { Actions } from '../../src';

describe('Actions class', () => {
  // ============================================================================
  // Actions.set and Actions.from
  // ============================================================================

  describe('Actions.set', () => {
    test('returns an ActionsBuilder', () => {
      const builder = Actions.set();
      expect(builder).toBeDefined();
      expect(typeof builder.all).toBe('function');
    });

    test('builder.get() returns Actions instance', () => {
      const actions = Actions.set().all().get();
      expect(actions).toBeInstanceOf(Actions);
    });
  });

  describe('Actions.from', () => {
    test('deserializes from bytes', () => {
      const originalActions = Actions.set().all().get();
      const bytes = originalActions.bytes();

      const deserialized = Actions.from(bytes, 1);
      expect(deserialized.count).toBe(1);
      expect(deserialized.isRoot()).toBe(true);
    });

    test('deserializes multiple actions', () => {
      const originalActions = Actions.set()
        .manageAuthority()
        .solLimit({ amount: 1_000_000_000n })
        .get();
      const bytes = originalActions.bytes();

      const deserialized = Actions.from(bytes, 2);
      expect(deserialized.count).toBe(2);
    });
  });

  // ============================================================================
  // Root permissions
  // ============================================================================

  describe('isRoot', () => {
    test('returns true for All permission', () => {
      const actions = Actions.set().all().get();
      expect(actions.isRoot()).toBe(true);
    });

    test('returns false for ManageAuthority only', () => {
      const actions = Actions.set().manageAuthority().get();
      expect(actions.isRoot()).toBe(false);
    });

    test('returns false for limited permissions', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.isRoot()).toBe(false);
    });
  });

  // ============================================================================
  // Authority management
  // ============================================================================

  describe('canManageAuthority', () => {
    test('returns false for All permission (All does NOT grant authority management)', () => {
      const actions = Actions.set().all().get();
      expect(actions.canManageAuthority()).toBe(false);
    });

    test('returns true for ManageAuthority permission', () => {
      const actions = Actions.set().manageAuthority().get();
      expect(actions.canManageAuthority()).toBe(true);
    });

    test('returns false for other permissions', () => {
      const actions = Actions.set().programAll().get();
      expect(actions.canManageAuthority()).toBe(false);
    });
  });

  // ============================================================================
  // Program permissions
  // ============================================================================

  describe('canUseProgram', () => {
    test('returns false for All permission (All does NOT grant program access)', () => {
      const actions = Actions.set().all().get();
      const randomProgram = Keypair.generate().publicKey;
      expect(actions.canUseProgram(randomProgram)).toBe(false);
    });

    test('returns true for ProgramAll permission', () => {
      const actions = Actions.set().programAll().get();
      const randomProgram = Keypair.generate().publicKey;
      expect(actions.canUseProgram(randomProgram)).toBe(true);
    });

    test('returns true for ProgramCurated permission with curated program', () => {
      const actions = Actions.set().programCurated().get();
      // System Program is a curated program
      const systemProgram = '11111111111111111111111111111111';
      expect(actions.canUseProgram(systemProgram)).toBe(true);
    });

    test('returns false for ProgramCurated permission with non-curated program', () => {
      const actions = Actions.set().programCurated().get();
      const randomProgram = Keypair.generate().publicKey;
      expect(actions.canUseProgram(randomProgram)).toBe(false);
    });

    test('returns true for matching program limit', () => {
      const programId = Keypair.generate().publicKey;
      const actions = Actions.set().programLimit({ programId }).get();
      expect(actions.canUseProgram(programId)).toBe(true);
    });

    test('returns false for non-matching program limit', () => {
      const programId = Keypair.generate().publicKey;
      const otherProgram = Keypair.generate().publicKey;
      const actions = Actions.set().programLimit({ programId }).get();
      expect(actions.canUseProgram(otherProgram)).toBe(false);
    });
  });

  describe('hasProgramAction', () => {
    test('returns false for All permission (All is NOT a program action)', () => {
      const actions = Actions.set().all().get();
      expect(actions.hasProgramAction()).toBe(false);
    });

    test('returns true for ProgramAll permission', () => {
      const actions = Actions.set().programAll().get();
      expect(actions.hasProgramAction()).toBe(true);
    });

    test('returns true for ProgramCurated permission', () => {
      const actions = Actions.set().programCurated().get();
      expect(actions.hasProgramAction()).toBe(true);
    });

    test('returns true for Program permission', () => {
      const programId = Keypair.generate().publicKey;
      const actions = Actions.set().programLimit({ programId }).get();
      expect(actions.hasProgramAction()).toBe(true);
    });

    test('returns false for non-program actions', () => {
      const actions = Actions.set().manageAuthority().get();
      expect(actions.hasProgramAction()).toBe(false);
    });
  });

  // ============================================================================
  // SOL spending
  // ============================================================================

  describe('canSpendSolMax', () => {
    test('returns true for All permission', () => {
      const actions = Actions.set().all().get();
      expect(actions.canSpendSolMax()).toBe(true);
    });

    test('returns false for limited SOL permission', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.canSpendSolMax()).toBe(false);
    });

    test('returns false for non-SOL permissions', () => {
      const actions = Actions.set().programAll().get();
      expect(actions.canSpendSolMax()).toBe(false);
    });
  });

  describe('canSpendSol', () => {
    test('returns true for All permission', () => {
      const actions = Actions.set().all().get();
      expect(actions.canSpendSol()).toBe(true);
    });

    test('returns true for any SOL limit when no amount specified', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.canSpendSol()).toBe(true);
    });

    test('returns true when amount is within limit', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.canSpendSol(500_000n)).toBe(true);
    });

    test('returns true when amount equals limit', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.canSpendSol(1_000_000n)).toBe(true);
    });

    test('returns false when amount exceeds limit', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.canSpendSol(2_000_000n)).toBe(false);
    });

    test('returns false for non-SOL permissions', () => {
      const actions = Actions.set().programAll().get();
      expect(actions.canSpendSol()).toBe(false);
    });
  });

  describe('solSpendLimit', () => {
    test('returns null for All permission (unlimited)', () => {
      const actions = Actions.set().all().get();
      expect(actions.solSpendLimit()).toBe(null);
    });

    test('returns limit amount for limited permission', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      expect(actions.solSpendLimit()).toBe(1_000_000n);
    });

    test('returns max limit when multiple limits exist', () => {
      const actions = Actions.set()
        .solLimit({ amount: 1_000_000n })
        .solLimit({ amount: 2_000_000n })
        .get();
      expect(actions.solSpendLimit()).toBe(2_000_000n);
    });

    test('returns null if any action has unlimited spend', () => {
      const actions = Actions.set()
        .all()
        .solLimit({ amount: 1_000_000n })
        .get();
      expect(actions.solSpendLimit()).toBe(null);
    });
  });

  describe('solSpend', () => {
    test('returns SpendController', () => {
      const actions = Actions.set().solLimit({ amount: 1_000_000n }).get();
      const controller = actions.solSpend();
      expect(controller).toBeDefined();
      expect(typeof controller.canSpend).toBe('function');
    });
  });

  // ============================================================================
  // Token spending
  // ============================================================================

  describe('canSpendTokenMax', () => {
    const mint = Keypair.generate().publicKey;

    test('returns true for All permission', () => {
      const actions = Actions.set().all().get();
      expect(actions.canSpendTokenMax(mint)).toBe(true);
    });

    test('returns false for limited token permission', () => {
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.canSpendTokenMax(mint)).toBe(false);
    });
  });

  describe('canSpendToken', () => {
    const mint = Keypair.generate().publicKey;

    test('returns true for All permission', () => {
      const actions = Actions.set().all().get();
      expect(actions.canSpendToken(mint)).toBe(true);
    });

    test('returns true for matching mint token limit', () => {
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.canSpendToken(mint)).toBe(true);
    });

    test('returns false for different mint', () => {
      const otherMint = Keypair.generate().publicKey;
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.canSpendToken(otherMint)).toBe(false);
    });

    test('returns true when amount is within limit', () => {
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.canSpendToken(mint, 500_000n)).toBe(true);
    });

    test('returns false when amount exceeds limit', () => {
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.canSpendToken(mint, 2_000_000n)).toBe(false);
    });
  });

  describe('tokenSpendLimit', () => {
    const mint = Keypair.generate().publicKey;

    test('returns null for All permission (unlimited)', () => {
      const actions = Actions.set().all().get();
      expect(actions.tokenSpendLimit(mint)).toBe(null);
    });

    test('returns limit amount for matching mint', () => {
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.tokenSpendLimit(mint)).toBe(1_000_000n);
    });

    test('returns 0 for non-matching mint', () => {
      const otherMint = Keypair.generate().publicKey;
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      expect(actions.tokenSpendLimit(otherMint)).toBe(0n);
    });
  });

  describe('tokenSpend', () => {
    const mint = Keypair.generate().publicKey;

    test('returns SpendController for matching mint', () => {
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      const controller = actions.tokenSpend(mint);
      expect(controller).toBeDefined();
      expect(controller.isAllowed).toBe(true);
    });

    test('returns SpendController with no control for non-matching mint', () => {
      const otherMint = Keypair.generate().publicKey;
      const actions = Actions.set()
        .tokenLimit({ mint, amount: 1_000_000n })
        .get();
      const controller = actions.tokenSpend(otherMint);
      expect(controller.isAllowed).toBe(false);
    });
  });

  // ============================================================================
  // bytes and count
  // ============================================================================

  describe('bytes', () => {
    test('returns Uint8Array', () => {
      const actions = Actions.set().all().get();
      const bytes = actions.bytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
    });

    test('bytes length increases with more actions', () => {
      const singleAction = Actions.set().all().get();
      const multipleActions = Actions.set()
        .all()
        .manageAuthority()
        .solLimit({ amount: 1_000_000n })
        .get();

      expect(multipleActions.bytes().length).toBeGreaterThan(
        singleAction.bytes().length,
      );
    });
  });

  describe('count', () => {
    test('returns correct count for single action', () => {
      const actions = Actions.set().all().get();
      expect(actions.count).toBe(1);
    });

    test('returns correct count for multiple actions', () => {
      const actions = Actions.set().all().manageAuthority().programAll().get();
      expect(actions.count).toBe(3);
    });
  });
});
