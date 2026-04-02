/**
 * Tests for ActionsBuilder class
 *
 * Tests the fluent API for building actions:
 * - Root permissions
 * - Program permissions
 * - SOL limits
 * - Token limits
 * - Staking
 * - Sub-accounts
 */

import { Keypair } from '@solana/web3.js';
import { NumericType } from '@swig-wallet/coder';
import { Actions } from '../../src';

describe('ActionsBuilder', () => {
  // ============================================================================
  // Root permissions
  // ============================================================================

  describe('root permissions', () => {
    test('all() creates All permission', () => {
      const actions = Actions.set().all().get();
      expect(actions.isRoot()).toBe(true);
      expect(actions.canManageAuthority()).toBe(true);
    });

    test('manageAuthority() creates ManageAuthority permission', () => {
      const actions = Actions.set().manageAuthority().get();
      expect(actions.canManageAuthority()).toBe(true);
      expect(actions.isRoot()).toBe(false);
    });

    test('allButManageAuthority() creates AllButManageAuthority permission', () => {
      const actions = Actions.set().allButManageAuthority().get();
      expect(actions.canManageAuthority()).toBe(false);
      expect(actions.isRoot()).toBe(false);
      expect(actions.count).toBe(1);
    });

    test('rentDestination() creates RentDestination permission', () => {
      const actions = Actions.set().rentDestination().get();
      expect(actions.count).toBe(1);
    });
  });

  // ============================================================================
  // Program permissions
  // ============================================================================

  describe('program permissions', () => {
    test('programLimit() sets specific program', () => {
      const programId = Keypair.generate().publicKey;
      const actions = Actions.set().programLimit({ programId }).get();

      expect(actions.canUseProgram(programId)).toBe(true);
      expect(actions.hasProgramAction()).toBe(true);
    });

    test('programLimit() rejects other programs', () => {
      const programId = Keypair.generate().publicKey;
      const otherProgramId = Keypair.generate().publicKey;
      const actions = Actions.set().programLimit({ programId }).get();

      expect(actions.canUseProgram(otherProgramId)).toBe(false);
    });

    test('programAll() sets ProgramAll permission', () => {
      const actions = Actions.set().programAll().get();
      const randomProgram = Keypair.generate().publicKey;

      expect(actions.canUseProgram(randomProgram)).toBe(true);
      expect(actions.hasProgramAction()).toBe(true);
    });

    test('programCurated() sets curated programs permission', () => {
      const actions = Actions.set().programCurated().get();
      const randomProgram = Keypair.generate().publicKey;

      expect(actions.canUseProgram(randomProgram)).toBe(true);
      expect(actions.hasProgramAction()).toBe(true);
    });

    test('programScopeBasic() creates basic scope', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.count).toBe(1);
    });

    test('programScopeLimit() creates limited scope', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeLimit({
          programId,
          targetAccount,
          amount: 1_000_000n,
          numericType: NumericType.U64,
        })
        .get();

      expect(actions.count).toBe(1);
    });

    test('programScopeRecurringLimit() creates recurring limited scope', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeRecurringLimit({
          programId,
          targetAccount,
          amount: 1_000_000n,
          window: 100n,
          numericType: NumericType.U64,
        })
        .get();

      expect(actions.count).toBe(1);
    });
  });

  // ============================================================================
  // SOL limits
  // ============================================================================

  describe('SOL limits', () => {
    test('solLimit() sets one-time limit', () => {
      const amount = 1_000_000_000n; // 1 SOL
      const actions = Actions.set().solLimit({ amount }).get();

      expect(actions.canSpendSol()).toBe(true);
      expect(actions.solSpendLimit()).toBe(amount);
    });

    test('solRecurringLimit() sets recurring limit', () => {
      const recurringAmount = 1_000_000_000n;
      const window = 100n; // slots
      const actions = Actions.set()
        .solRecurringLimit({ recurringAmount, window })
        .get();

      expect(actions.canSpendSol()).toBe(true);
      const controller = actions.solSpend();
      expect(controller.window).toBe(window);
    });

    test('solDestinationLimit() sets destination-specific limit', () => {
      const destination = Keypair.generate().publicKey;
      const amount = 1_000_000_000n;
      const actions = Actions.set()
        .solDestinationLimit({ amount, destination })
        .get();

      expect(actions.canSpendSol()).toBe(true);
      expect(actions.solSpendLimit()).toBe(amount);
    });

    test('solRecurringDestinationLimit() sets recurring destination limit', () => {
      const destination = Keypair.generate().publicKey;
      const recurringAmount = 1_000_000_000n;
      const window = 100n;
      const actions = Actions.set()
        .solRecurringDestinationLimit({ recurringAmount, window, destination })
        .get();

      expect(actions.canSpendSol()).toBe(true);
      const controller = actions.solSpend();
      expect(controller.window).toBe(window);
    });
  });

  // ============================================================================
  // Token limits
  // ============================================================================

  describe('Token limits', () => {
    const mint = Keypair.generate().publicKey;

    test('tokenLimit() sets one-time limit', () => {
      const amount = 1_000_000n;
      const actions = Actions.set().tokenLimit({ mint, amount }).get();

      expect(actions.canSpendToken(mint)).toBe(true);
      expect(actions.tokenSpendLimit(mint)).toBe(amount);
    });

    test('tokenRecurringLimit() sets recurring limit', () => {
      const recurringAmount = 1_000_000n;
      const window = 100n;
      const actions = Actions.set()
        .tokenRecurringLimit({ mint, recurringAmount, window })
        .get();

      expect(actions.canSpendToken(mint)).toBe(true);
      const controller = actions.tokenSpend(mint);
      expect(controller.window).toBe(window);
    });

    test('tokenDestinationLimit() sets destination-specific limit', () => {
      const destination = Keypair.generate().publicKey;
      const amount = 1_000_000n;
      const actions = Actions.set()
        .tokenDestinationLimit({ mint, amount, destination })
        .get();

      expect(actions.canSpendToken(mint)).toBe(true);
      expect(actions.tokenSpendLimit(mint)).toBe(amount);
    });

    test('tokenRecurringDestinationLimit() sets recurring destination limit', () => {
      const destination = Keypair.generate().publicKey;
      const recurringAmount = 1_000_000n;
      const window = 100n;
      const actions = Actions.set()
        .tokenRecurringDestinationLimit({
          mint,
          recurringAmount,
          window,
          destination,
        })
        .get();

      expect(actions.canSpendToken(mint)).toBe(true);
      const controller = actions.tokenSpend(mint);
      expect(controller.window).toBe(window);
    });
  });

  // ============================================================================
  // Staking
  // ============================================================================

  describe('Staking', () => {
    test('stakeAll() sets all staking permission', () => {
      const actions = Actions.set().stakeAll().get();
      expect(actions.count).toBe(1);
    });

    test('stakeLimit() sets stake limit', () => {
      const amount = 1_000_000_000n;
      const actions = Actions.set().stakeLimit({ amount }).get();
      expect(actions.count).toBe(1);
    });

    test('stakeRecurringLimit() sets recurring stake limit', () => {
      const recurringAmount = 1_000_000_000n;
      const window = 100n;
      const actions = Actions.set()
        .stakeRecurringLimit({ recurringAmount, window })
        .get();
      expect(actions.count).toBe(1);
    });
  });

  // ============================================================================
  // Sub-accounts
  // ============================================================================

  describe('Sub-accounts', () => {
    test('subAccount() sets sub-account permission', () => {
      const actions = Actions.set().subAccount().get();
      expect(actions.count).toBe(1);
    });
  });

  // ============================================================================
  // Chaining
  // ============================================================================

  describe('Chaining', () => {
    test('chains multiple actions together', () => {
      const actions = Actions.set()
        .manageAuthority()
        .programAll()
        .solLimit({ amount: 1_000_000_000n })
        .get();

      expect(actions.count).toBe(3);
      expect(actions.canManageAuthority()).toBe(true);
      expect(actions.hasProgramAction()).toBe(true);
      expect(actions.canSpendSol()).toBe(true);
    });

    test('each builder method returns this for chaining', () => {
      const builder = Actions.set();

      // Each method should return the same builder instance for chaining
      expect(builder.all()).toBe(builder);
      expect(builder.manageAuthority()).toBe(builder);
      expect(builder.rentDestination()).toBe(builder);
      expect(builder.programAll()).toBe(builder);
    });
  });
});
