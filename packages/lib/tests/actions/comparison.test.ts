/**
 * Tests for Action and Actions comparison primitives
 *
 * Tests the comparison methods:
 * - Action.covers() - Check if an action covers another
 * - Action.equals() - Semantic equality of actions
 * - Actions.covers() - Check if an Actions set covers another
 * - Actions.equals() - Semantic equality of action sets
 * - Actions.effectiveActions() - Normalized effective actions
 */

import { Keypair } from '@solana/web3.js';
import { Permission, NumericType } from '@swig-wallet/coder';
import { Actions, Action, type EffectiveActions, type CoverageResult } from '../../src';
import { CURATED_PROGRAMS } from '../../src/actions/constants';

describe('Action comparison', () => {
  // ============================================================================
  // Action.covers() - All and AllButManageAuthority
  // ============================================================================

  describe('Action.covers() - All permission', () => {
    test('All covers spend actions (SolLimit)', () => {
      const allActions = Actions.set().all().get();
      const solLimitActions = Actions.set().solLimit({ amount: 100n }).get();

      const allAction = allActions.getActions()[0];
      const solLimitAction = solLimitActions.getActions()[0];

      expect(allAction.covers(solLimitAction)).toBe(true);
    });

    test('All covers send actions (SolDestinationLimit)', () => {
      const allActions = Actions.set().all().get();
      const destination = Keypair.generate().publicKey;
      const destLimitActions = Actions.set()
        .solDestinationLimit({ destination, amount: 100n })
        .get();

      const allAction = allActions.getActions()[0];
      const destLimitAction = destLimitActions.getActions()[0];

      expect(allAction.covers(destLimitAction)).toBe(true);
    });

    test('All covers stake actions (StakeLimit)', () => {
      const allActions = Actions.set().all().get();
      const stakeLimitActions = Actions.set().stakeLimit({ amount: 100n }).get();

      const allAction = allActions.getActions()[0];
      const stakeLimitAction = stakeLimitActions.getActions()[0];

      expect(allAction.covers(stakeLimitAction)).toBe(true);
    });

    test('All does NOT cover program actions', () => {
      const allActions = Actions.set().all().get();
      const programAllActions = Actions.set().programAll().get();

      const allAction = allActions.getActions()[0];
      const programAllAction = programAllActions.getActions()[0];

      expect(allAction.covers(programAllAction)).toBe(false);
    });

    test('All does NOT cover ManageAuthority', () => {
      const allActions = Actions.set().all().get();
      const manageAuthorityActions = Actions.set().manageAuthority().get();

      const allAction = allActions.getActions()[0];
      const manageAuthorityAction = manageAuthorityActions.getActions()[0];

      expect(allAction.covers(manageAuthorityAction)).toBe(false);
    });

    test('AllButManageAuthority does NOT cover ManageAuthority', () => {
      const allButActions = Actions.set().allButManageAuthority().get();
      const manageAuthorityActions = Actions.set().manageAuthority().get();

      const allButAction = allButActions.getActions()[0];
      const manageAuthorityAction = manageAuthorityActions.getActions()[0];

      expect(allButAction.covers(manageAuthorityAction)).toBe(false);
    });
  });

  // ============================================================================
  // Action.covers() - Same type comparison
  // ============================================================================

  describe('Action.covers() - Same type', () => {
    test('SolLimit(100) covers SolLimit(50)', () => {
      const higher = Actions.set().solLimit({ amount: 100n }).get();
      const lower = Actions.set().solLimit({ amount: 50n }).get();

      expect(higher.getActions()[0].covers(lower.getActions()[0])).toBe(true);
    });

    test('SolLimit(50) does NOT cover SolLimit(100)', () => {
      const lower = Actions.set().solLimit({ amount: 50n }).get();
      const higher = Actions.set().solLimit({ amount: 100n }).get();

      expect(lower.getActions()[0].covers(higher.getActions()[0])).toBe(false);
    });

    test('SolLimit(100) covers SolLimit(100)', () => {
      const a = Actions.set().solLimit({ amount: 100n }).get();
      const b = Actions.set().solLimit({ amount: 100n }).get();

      expect(a.getActions()[0].covers(b.getActions()[0])).toBe(true);
    });

    test('SolDestinationLimit covers same destination with higher amount', () => {
      const destination = Keypair.generate().publicKey;
      const higher = Actions.set()
        .solDestinationLimit({ destination, amount: 100n })
        .get();
      const lower = Actions.set()
        .solDestinationLimit({ destination, amount: 50n })
        .get();

      expect(higher.getActions()[0].covers(lower.getActions()[0])).toBe(true);
    });

    test('SolDestinationLimit does NOT cover different destination', () => {
      const destA = Keypair.generate().publicKey;
      const destB = Keypair.generate().publicKey;
      const actionA = Actions.set()
        .solDestinationLimit({ destination: destA, amount: 100n })
        .get();
      const actionB = Actions.set()
        .solDestinationLimit({ destination: destB, amount: 50n })
        .get();

      expect(actionA.getActions()[0].covers(actionB.getActions()[0])).toBe(false);
    });

    test('TokenLimit does NOT cover different mint', () => {
      const mintA = Keypair.generate().publicKey;
      const mintB = Keypair.generate().publicKey;
      const actionA = Actions.set()
        .tokenLimit({ mint: mintA, amount: 100n })
        .get();
      const actionB = Actions.set()
        .tokenLimit({ mint: mintB, amount: 50n })
        .get();

      expect(actionA.getActions()[0].covers(actionB.getActions()[0])).toBe(false);
    });
  });

  // ============================================================================
  // Action.covers() - Cross type comparison
  // ============================================================================

  describe('Action.covers() - Cross type', () => {
    test('SolLimit covers SolDestinationLimit', () => {
      const destination = Keypair.generate().publicKey;
      const solLimit = Actions.set().solLimit({ amount: 100n }).get();
      const destLimit = Actions.set()
        .solDestinationLimit({ destination, amount: 50n })
        .get();

      expect(solLimit.getActions()[0].covers(destLimit.getActions()[0])).toBe(true);
    });

    test('SolLimit covers SolRecurringLimit', () => {
      const solLimit = Actions.set().solLimit({ amount: 100n }).get();
      const recurringLimit = Actions.set()
        .solRecurringLimit({ recurringAmount: 50n, window: 3600n })
        .get();

      expect(solLimit.getActions()[0].covers(recurringLimit.getActions()[0])).toBe(true);
    });

    test('TokenLimit covers TokenDestinationLimit (same mint)', () => {
      const mint = Keypair.generate().publicKey;
      const destination = Keypair.generate().publicKey;
      const tokenLimit = Actions.set()
        .tokenLimit({ mint, amount: 100n })
        .get();
      const destLimit = Actions.set()
        .tokenDestinationLimit({ mint, destination, amount: 50n })
        .get();

      expect(tokenLimit.getActions()[0].covers(destLimit.getActions()[0])).toBe(true);
    });

    test('TokenLimit does NOT cover TokenDestinationLimit (different mint)', () => {
      const mintA = Keypair.generate().publicKey;
      const mintB = Keypair.generate().publicKey;
      const destination = Keypair.generate().publicKey;
      const tokenLimit = Actions.set()
        .tokenLimit({ mint: mintA, amount: 100n })
        .get();
      const destLimit = Actions.set()
        .tokenDestinationLimit({ mint: mintB, destination, amount: 50n })
        .get();

      expect(tokenLimit.getActions()[0].covers(destLimit.getActions()[0])).toBe(false);
    });

    test('ProgramAll covers Program', () => {
      const programId = Keypair.generate().publicKey;
      const programAll = Actions.set().programAll().get();
      const program = Actions.set().programLimit({ programId }).get();

      expect(programAll.getActions()[0].covers(program.getActions()[0])).toBe(true);
    });

    test('ProgramAll covers ProgramCurated', () => {
      const programAll = Actions.set().programAll().get();
      const programCurated = Actions.set().programCurated().get();

      expect(programAll.getActions()[0].covers(programCurated.getActions()[0])).toBe(true);
    });

    test('StakeAll covers StakeLimit', () => {
      const stakeAll = Actions.set().stakeAll().get();
      const stakeLimit = Actions.set().stakeLimit({ amount: 100n }).get();

      expect(stakeAll.getActions()[0].covers(stakeLimit.getActions()[0])).toBe(true);
    });

    test('StakeAll covers StakeRecurringLimit', () => {
      const stakeAll = Actions.set().stakeAll().get();
      const stakeRecurring = Actions.set()
        .stakeRecurringLimit({ recurringAmount: 100n, window: 3600n })
        .get();

      expect(stakeAll.getActions()[0].covers(stakeRecurring.getActions()[0])).toBe(true);
    });
  });

  // ============================================================================
  // Action.equals()
  // ============================================================================

  describe('Action.equals()', () => {
    test('SolLimit equals same SolLimit', () => {
      const a = Actions.set().solLimit({ amount: 100n }).get();
      const b = Actions.set().solLimit({ amount: 100n }).get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(true);
    });

    test('SolLimit does NOT equal different amount', () => {
      const a = Actions.set().solLimit({ amount: 100n }).get();
      const b = Actions.set().solLimit({ amount: 50n }).get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(false);
    });

    test('SolLimit does NOT equal TokenLimit', () => {
      const mint = Keypair.generate().publicKey;
      const solLimit = Actions.set().solLimit({ amount: 100n }).get();
      const tokenLimit = Actions.set().tokenLimit({ mint, amount: 100n }).get();

      expect(solLimit.getActions()[0].equals(tokenLimit.getActions()[0])).toBe(false);
    });

    test('All equals All', () => {
      const a = Actions.set().all().get();
      const b = Actions.set().all().get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(true);
    });

    test('ManageAuthority equals ManageAuthority', () => {
      const a = Actions.set().manageAuthority().get();
      const b = Actions.set().manageAuthority().get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(true);
    });

    test('TokenLimit equals same mint and amount', () => {
      const mint = Keypair.generate().publicKey;
      const a = Actions.set().tokenLimit({ mint, amount: 100n }).get();
      const b = Actions.set().tokenLimit({ mint, amount: 100n }).get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(true);
    });

    test('Program equals same programId', () => {
      const programId = Keypair.generate().publicKey;
      const a = Actions.set().programLimit({ programId }).get();
      const b = Actions.set().programLimit({ programId }).get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(true);
    });

    test('Program does NOT equal different programId', () => {
      const programA = Keypair.generate().publicKey;
      const programB = Keypair.generate().publicKey;
      const a = Actions.set().programLimit({ programId: programA }).get();
      const b = Actions.set().programLimit({ programId: programB }).get();

      expect(a.getActions()[0].equals(b.getActions()[0])).toBe(false);
    });
  });

  // ============================================================================
  // Actions.effectiveActions()
  // ============================================================================

  describe('Actions.effectiveActions()', () => {
    test('returns normalized structure', () => {
      const actions = Actions.set().all().get();
      const effective = actions.effectiveActions();

      expect(effective).toHaveProperty('manageAuthority');
      expect(effective).toHaveProperty('program');
      expect(effective).toHaveProperty('programScopes');
      expect(effective).toHaveProperty('spend');
      expect(effective).toHaveProperty('send');
      expect(effective).toHaveProperty('stake');
    });

    test('SolLimit takes priority over SolRecurringLimit', () => {
      const actions = Actions.set()
        .solRecurringLimit({ recurringAmount: 50n, window: 3600n })
        .solLimit({ amount: 100n })
        .get();
      const effective = actions.effectiveActions();

      expect(effective.spend.sol).not.toBeNull();
      expect(effective.spend.sol!.permission).toBe(Permission.SolLimit);
    });

    test('First SolLimit wins (non-repeatable)', () => {
      const actions = Actions.set()
        .solLimit({ amount: 100n })
        .solLimit({ amount: 200n })
        .get();
      const effective = actions.effectiveActions();

      expect(effective.spend.sol).not.toBeNull();
      // First one should win
    });

    test('StakeAll takes priority over StakeLimit', () => {
      const actions = Actions.set()
        .stakeLimit({ amount: 100n })
        .stakeAll()
        .get();
      const effective = actions.effectiveActions();

      expect(effective.stake).not.toBeNull();
      expect(effective.stake!.permission).toBe(Permission.StakeAll);
    });

    test('ProgramAll overrides specific Program', () => {
      const programId = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programLimit({ programId })
        .programAll()
        .get();
      const effective = actions.effectiveActions();

      expect(effective.program).toHaveLength(1);
      expect(effective.program[0].permission).toBe(Permission.ProgramAll);
    });

    test('Multiple token limits kept per mint', () => {
      const mintA = Keypair.generate().publicKey;
      const mintB = Keypair.generate().publicKey;
      const actions = Actions.set()
        .tokenLimit({ mint: mintA, amount: 100n })
        .tokenLimit({ mint: mintB, amount: 200n })
        .get();
      const effective = actions.effectiveActions();

      expect(effective.spend.tokens.size).toBe(2);
    });

    test('Multiple destination limits kept per destination', () => {
      const destA = Keypair.generate().publicKey;
      const destB = Keypair.generate().publicKey;
      const actions = Actions.set()
        .solDestinationLimit({ destination: destA, amount: 100n })
        .solDestinationLimit({ destination: destB, amount: 200n })
        .get();
      const effective = actions.effectiveActions();

      expect(effective.send.sol.size).toBe(2);
    });
  });

  // ============================================================================
  // Actions.covers()
  // ============================================================================

  describe('Actions.covers()', () => {
    test('[All] covers [SolLimit] - vacuously true for program/manageAuthority', () => {
      const thisActions = Actions.set().all().get();
      const otherActions = Actions.set().solLimit({ amount: 100n }).get();

      const result = thisActions.covers(otherActions);

      expect(result.spend).toBe(true);
      expect(result.send).toBe(true);
      expect(result.stake).toBe(true);
      expect(result.program).toBe(true); // Vacuously true - other has no program actions
      expect(result.manageAuthority).toBe(true); // Vacuously true - other has no manageAuthority
      expect(result.full).toBe(true);
    });

    test('[All] does NOT cover [ProgramAll]', () => {
      const thisActions = Actions.set().all().get();
      const otherActions = Actions.set().programAll().get();

      const result = thisActions.covers(otherActions);

      expect(result.program).toBe(false);
      expect(result.full).toBe(false);
    });

    test('[All, ProgramAll] covers [SolLimit, ProgramAll]', () => {
      const thisActions = Actions.set().all().programAll().get();
      const otherActions = Actions.set().solLimit({ amount: 100n }).programAll().get();

      const result = thisActions.covers(otherActions);

      expect(result.spend).toBe(true);
      expect(result.program).toBe(true);
      expect(result.full).toBe(true);
    });

    test('[SolLimit(100)] covers [SolLimit(50)]', () => {
      const thisActions = Actions.set().solLimit({ amount: 100n }).get();
      const otherActions = Actions.set().solLimit({ amount: 50n }).get();

      const result = thisActions.covers(otherActions);

      expect(result.spend).toBe(true);
    });

    test('[SolLimit(50)] does NOT cover [SolLimit(100)]', () => {
      const thisActions = Actions.set().solLimit({ amount: 50n }).get();
      const otherActions = Actions.set().solLimit({ amount: 100n }).get();

      const result = thisActions.covers(otherActions);

      expect(result.spend).toBe(false);
      expect(result.full).toBe(false);
    });

    test('[Program(A)] does NOT cover [Program(B)]', () => {
      const programA = Keypair.generate().publicKey;
      const programB = Keypair.generate().publicKey;
      const thisActions = Actions.set().programLimit({ programId: programA }).get();
      const otherActions = Actions.set().programLimit({ programId: programB }).get();

      const result = thisActions.covers(otherActions);

      expect(result.program).toBe(false);
      expect(result.full).toBe(false);
    });

    test('[ManageAuthority] covers [ManageAuthority]', () => {
      const thisActions = Actions.set().manageAuthority().get();
      const otherActions = Actions.set().manageAuthority().get();

      const result = thisActions.covers(otherActions);

      expect(result.manageAuthority).toBe(true);
    });

    test('empty Actions covers empty Actions', () => {
      // Create minimal actions then remove them conceptually
      const thisActions = Actions.set().programAll().get();
      const otherActions = Actions.set().programAll().get();

      const result = thisActions.covers(otherActions);

      expect(result.full).toBe(true);
    });
  });

  // ============================================================================
  // Actions.equals()
  // ============================================================================

  describe('Actions.equals()', () => {
    test('same actions are equal', () => {
      const a = Actions.set().solLimit({ amount: 100n }).get();
      const b = Actions.set().solLimit({ amount: 100n }).get();

      expect(a.equals(b)).toBe(true);
    });

    test('different actions are not equal', () => {
      const a = Actions.set().solLimit({ amount: 100n }).get();
      const b = Actions.set().solLimit({ amount: 50n }).get();

      expect(a.equals(b)).toBe(false);
    });

    test('order independent - different order is equal', () => {
      const mint = Keypair.generate().publicKey;
      const a = Actions.set()
        .solLimit({ amount: 100n })
        .tokenLimit({ mint, amount: 200n })
        .get();
      const b = Actions.set()
        .tokenLimit({ mint, amount: 200n })
        .solLimit({ amount: 100n })
        .get();

      expect(a.equals(b)).toBe(true);
    });

    test('effective actions normalized - redundant actions removed', () => {
      const a = Actions.set()
        .solLimit({ amount: 100n })
        .solRecurringLimit({ recurringAmount: 50n, window: 3600n })
        .get();
      const b = Actions.set().solLimit({ amount: 100n }).get();

      // After normalization, both should have only SolLimit(100) as effective
      expect(a.equals(b)).toBe(true);
    });

    test('All equals All', () => {
      const a = Actions.set().all().get();
      const b = Actions.set().all().get();

      expect(a.equals(b)).toBe(true);
    });

    test('All + ManageAuthority equals ManageAuthority + All', () => {
      const a = Actions.set().all().manageAuthority().get();
      const b = Actions.set().manageAuthority().all().get();

      expect(a.equals(b)).toBe(true);
    });

    test('multiple token limits equal when same mints', () => {
      const mintA = Keypair.generate().publicKey;
      const mintB = Keypair.generate().publicKey;
      const a = Actions.set()
        .tokenLimit({ mint: mintA, amount: 100n })
        .tokenLimit({ mint: mintB, amount: 200n })
        .get();
      const b = Actions.set()
        .tokenLimit({ mint: mintB, amount: 200n })
        .tokenLimit({ mint: mintA, amount: 100n })
        .get();

      expect(a.equals(b)).toBe(true);
    });

    test('different mints are not equal', () => {
      const mintA = Keypair.generate().publicKey;
      const mintB = Keypair.generate().publicKey;
      const a = Actions.set().tokenLimit({ mint: mintA, amount: 100n }).get();
      const b = Actions.set().tokenLimit({ mint: mintB, amount: 100n }).get();

      expect(a.equals(b)).toBe(false);
    });
  });

  // ============================================================================
  // ProgramScope methods
  // ============================================================================

  describe('ProgramScope methods', () => {
    test('hasProgramScope returns true for ProgramScope action', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.getActions()[0].hasProgramScope()).toBe(true);
    });

    test('hasProgramScope returns false for non-ProgramScope action', () => {
      const action = Actions.set().all().get().getActions()[0];
      expect(action.hasProgramScope()).toBe(false);
    });

    test('getProgramScopeData returns scope data for ProgramScope action', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeLimit({
          programId,
          targetAccount,
          amount: 1000n,
          numericType: NumericType.U64,
        })
        .get();

      const scopeData = actions.getActions()[0].getProgramScopeData();

      expect(scopeData).not.toBeNull();
      expect(scopeData!.limit).toBe(1000n);
    });

    test('getProgramScopeData returns null for non-ProgramScope action', () => {
      const action = Actions.set().all().get().getActions()[0];
      expect(action.getProgramScopeData()).toBeNull();
    });

    test('matchesTargetAccount returns true for matching target', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.getActions()[0].matchesTargetAccount(targetAccount)).toBe(true);
    });

    test('matchesTargetAccount returns false for different target', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const otherTarget = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.getActions()[0].matchesTargetAccount(otherTarget)).toBe(false);
    });

    test('getProgramScopes returns all ProgramScope actions', () => {
      const programId = Keypair.generate().publicKey;
      const targetA = Keypair.generate().publicKey;
      const targetB = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount: targetA })
        .programScopeBasic({ programId, targetAccount: targetB })
        .solLimit({ amount: 100n })
        .get();

      const scopes = actions.getProgramScopes();
      expect(scopes).toHaveLength(2);
      expect(scopes.every((s) => s.hasProgramScope())).toBe(true);
    });

    test('hasScopeForAccount returns true for matching target', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.hasScopeForAccount(targetAccount)).toBe(true);
    });

    test('hasScopeForAccount returns false for non-matching target', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const otherTarget = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.hasScopeForAccount(otherTarget)).toBe(false);
    });

    test('getScopeForAccount returns action for matching target', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeLimit({
          programId,
          targetAccount,
          amount: 500n,
          numericType: NumericType.U64,
        })
        .get();

      const scope = actions.getScopeForAccount(targetAccount);
      expect(scope).not.toBeNull();
      expect(scope!.getProgramScopeData()!.limit).toBe(500n);
    });

    test('getScopeForAccount returns null for non-matching target', () => {
      const programId = Keypair.generate().publicKey;
      const targetAccount = Keypair.generate().publicKey;
      const otherTarget = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount })
        .get();

      expect(actions.getScopeForAccount(otherTarget)).toBeNull();
    });

    test('effectiveActions includes programScopes', () => {
      const programId = Keypair.generate().publicKey;
      const targetA = Keypair.generate().publicKey;
      const targetB = Keypair.generate().publicKey;
      const actions = Actions.set()
        .programScopeBasic({ programId, targetAccount: targetA })
        .programScopeBasic({ programId, targetAccount: targetB })
        .get();

      const effective = actions.effectiveActions();
      expect(effective.programScopes).toHaveLength(2);
    });
  });

  // ============================================================================
  // Action.getCategory()
  // ============================================================================

  describe('Action.getCategory()', () => {
    test('ManageAuthority returns manageAuthority category', () => {
      const action = Actions.set().manageAuthority().get().getActions()[0];
      expect(action.getCategory()).toBe('manageAuthority');
    });

    test('ProgramAll returns program category', () => {
      const action = Actions.set().programAll().get().getActions()[0];
      expect(action.getCategory()).toBe('program');
    });

    test('SolLimit returns spend category', () => {
      const action = Actions.set().solLimit({ amount: 100n }).get().getActions()[0];
      expect(action.getCategory()).toBe('spend');
    });

    test('SolDestinationLimit returns send category', () => {
      const destination = Keypair.generate().publicKey;
      const action = Actions.set()
        .solDestinationLimit({ destination, amount: 100n })
        .get()
        .getActions()[0];
      expect(action.getCategory()).toBe('send');
    });

    test('StakeAll returns stake category', () => {
      const action = Actions.set().stakeAll().get().getActions()[0];
      expect(action.getCategory()).toBe('stake');
    });

    test('All returns other category', () => {
      const action = Actions.set().all().get().getActions()[0];
      expect(action.getCategory()).toBe('other');
    });
  });
});
