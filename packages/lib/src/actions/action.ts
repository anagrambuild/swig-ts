import {
  ACTION_HEADER_LENGTH,
  getActionHeaderDecoder,
  Permission,
  type ActionHeader,
} from '@swig-wallet/coder';
import { SolPublicKey, type SolPublicKeyData } from '../solana';
import { ActionsBuilder } from './builder';
import { isCuratedProgram } from './constants';
import { SpendController } from './control';
import {
  decodeActionPayload,
  isActionPayload,
  type ActionPayload,
} from './payload';

// ============================================================================
// Helper functions for action comparison
// ============================================================================

/**
 * Compare two byte arrays for equality
 */
function bytesEqual(
  a: Uint8Array | ArrayLike<number>,
  b: Uint8Array | ArrayLike<number>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Check if amount `a` covers amount `b`.
 * null means unlimited, which covers any finite amount.
 * A higher/equal amount covers a lower amount.
 */
function amountCovers(a: bigint | null, b: bigint | null): boolean {
  // null (unlimited) covers everything
  if (a === null) return true;
  // finite cannot cover unlimited
  if (b === null) return false;
  // finite covers finite if a >= b
  return a >= b;
}

/**
 * Permission categories for coverage checking
 */
type PermissionCategory =
  | 'manageAuthority'
  | 'program'
  | 'spend'
  | 'send'
  | 'stake'
  | 'programScope'
  | 'other';

/**
 * Effective actions after applying on-chain priority rules.
 * For non-repeatable types, only the first action is kept.
 * For repeatable types with the same resource, only the first is kept.
 */
export interface EffectiveActions {
  /** ManageAuthority action or null */
  manageAuthority: Action | null;
  /** Program actions: ProgramAll, ProgramCurated, or specific Programs (NOT ProgramScope) */
  program: Action[];
  /** ProgramScope actions (separate - limits account interactions, not program calls) */
  programScopes: Action[];
  /** Spend limits */
  spend: {
    /** SolLimit > SolRecurringLimit (first wins) */
    sol: Action | null;
    /** Per-mint: TokenLimit > TokenRecurringLimit */
    tokens: Map<string, Action>;
  };
  /** Send/destination limits */
  send: {
    /** Per-destination: SolDestinationLimit > SolRecurringDestinationLimit */
    sol: Map<string, Action>;
    /** Per mint+destination: TokenDestinationLimit > TokenRecurringDestinationLimit */
    tokens: Map<string, Action>;
  };
  /** StakeAll > StakeLimit > StakeRecurringLimit */
  stake: Action | null;
}

/**
 * Coverage result for Actions.covers() comparison.
 * For each category, returns true if every action in `other` for that category
 * is covered by some action in `this`. Vacuously true if `other` has no actions
 * in that category.
 */
export interface CoverageResult {
  /** Covers all manageAuthority actions in other (true if other has none) */
  manageAuthority: boolean;
  /** Covers all program actions in other (true if other has none) */
  program: boolean;
  /** Covers all spend actions in other (true if other has none) */
  spend: boolean;
  /** Covers all send actions in other (true if other has none) */
  send: boolean;
  /** Covers all stake actions in other (true if other has none) */
  stake: boolean;
  /** All above are true */
  full: boolean;
}

/**
 * Get the category for a permission type
 */
function getPermissionCategory(permission: Permission): PermissionCategory {
  switch (permission) {
    case Permission.ManageAuthority:
      return 'manageAuthority';

    case Permission.Program:
    case Permission.ProgramAll:
    case Permission.ProgramCurated:
      return 'program';

    case Permission.SolLimit:
    case Permission.SolRecurringLimit:
    case Permission.TokenLimit:
    case Permission.TokenRecurringLimit:
      return 'spend';

    case Permission.SolDestinationLimit:
    case Permission.SolRecurringDestinationLimit:
    case Permission.TokenDestinationLimit:
    case Permission.TokenRecurringDestinationLimit:
      return 'send';

    case Permission.StakeAll:
    case Permission.StakeLimit:
    case Permission.StakeRecurringLimit:
      return 'stake';

    case Permission.ProgramScope:
      return 'programScope';

    case Permission.All:
    case Permission.AllButManageAuthority:
      // All covers spend, send, stake but NOT program or manageAuthority
      return 'other';

    default:
      return 'other';
  }
}

/**
 * Helper function to ensure ProgramAll action is added if no program-related actions exist
 * This is only used when adding new authorities, not when creating the initial swig.
 * Root authorities should only have All or ManageAuthority permissions.
 * @param actions - The actions to check and potentially modify
 * @returns Actions with ProgramAll added if no program actions were present
 */
export function ensureProgramAction(actions: Actions): Actions {
  // Check if actions already have root permission (All) - if so, no need to add program actions
  if (actions.isRoot()) {
    return actions;
  }

  // Check if actions already have any program-related permissions
  const hasExistingProgramAction = actions.hasProgramAction();

  if (!hasExistingProgramAction) {
    // No program permissions exist, so we need to add ProgramAll
    // Create a new Actions object by combining the existing actions buffer with ProgramAll
    const programAllAction = Actions.set().programAll().get();

    // Combine the existing actions buffer with the ProgramAll action buffer
    const combinedBuffer = new Uint8Array(
      actions.bytes().length + programAllAction.bytes().length,
    );
    combinedBuffer.set(actions.bytes(), 0);
    combinedBuffer.set(programAllAction.bytes(), actions.bytes().length);

    // Create new Actions object with combined buffer and updated count
    return Actions.from(combinedBuffer, actions.count + programAllAction.count);
  }

  // Actions already have program permissions, return as-is
  return actions;
}

/**
 * Utility class from managing actions grouped together.
 */
export class Actions {
  private constructor(
    /**
     * action buffer
     */
    private readonly raw: Uint8Array,
    private readonly actions: Action[],
  ) {}

  /**
   * Creates a new action
   * @param raw Buffer of a given number of actions
   * @param count number of actions
   * @returns Actions
   */
  static from(raw: Uint8Array, count: number) {
    const actions = deserializeActions(raw, count);
    return new Actions(raw, actions);
  }

  /**
   * Returns a builder for chaining actions together.
   * Call `.set()` at the end of the chain to put these actions together
   * @returns ActionsBuilder
   */
  static set(): ActionsBuilder {
    return ActionsBuilder.new();
  }

  /**
   * Number of actions
   */
  get count() {
    return this.actions.length;
  }

  bytes() {
    return this.raw;
  }

  /**
   * Check if root action is present
   * @returns boolean
   */
  isRoot(): boolean {
    return !!this.actions.find((action) => action.isRoot());
  }

  /**
   * Check if authority manager action is present
   * @returns boolean
   */
  canManageAuthority(): boolean {
    return !!this.actions.find((action) => action.canManageAuthority());
  }

  /**
   * Check if the action can interact with a given program
   * @param programId ID of the Program to interact with
   * @returns boolean
   */
  canUseProgram(programId: SolPublicKeyData): boolean {
    return !!this.actions.find((action) => action.canUseProgram(programId));
  }

  /**
   * Check if any program-related action is present (Program, ProgramAll, ProgramCurated, ProgramScope).
   * Note: All permission is NOT a program action.
   * @returns boolean
   */
  hasProgramAction(): boolean {
    return !!this.actions.find((action) => action.hasProgramAction());
  }

  /**
   * Get all ProgramScope actions.
   * ProgramScope actions limit interactions with specific target accounts within programs.
   * @returns Array of ProgramScope actions
   */
  getProgramScopes(): Action[] {
    return this.actions.filter((action) => action.hasProgramScope());
  }

  /**
   * Check if actions have a scope for a specific target account.
   * @param targetAccount The target account to check
   * @returns true if there's a ProgramScope for the given target account
   */
  hasScopeForAccount(targetAccount: SolPublicKeyData): boolean {
    return !!this.actions.find(
      (action) =>
        action.hasProgramScope() && action.matchesTargetAccount(targetAccount),
    );
  }

  /**
   * Get the ProgramScope action for a specific target account.
   * @param targetAccount The target account to get the scope for
   * @returns The ProgramScope action or null if not found
   */
  getScopeForAccount(targetAccount: SolPublicKeyData): Action | null {
    return (
      this.actions.find(
        (action) =>
          action.hasProgramScope() && action.matchesTargetAccount(targetAccount),
      ) ?? null
    );
  }

  /**
   * Check if Sol Spend is uncapped
   * @returns boolean
   */
  canSpendSolMax(): boolean {
    return !!this.actions.find((action) => action.solControl().canSpendMax());
  }

  /**
   * Check if Sol Spend is allowed. If `amount` is provided,
   * it will return `true` if the action can spend the given amoount of Sol
   * @param amount - minimum spendaable amount
   * @returns boolean
   */
  canSpendSol(amount?: bigint): boolean {
    return !!this.actions.find((action) =>
      action.solControl().canSpend(amount),
    );
  }

  /**
   * Gets the spend limit for a SOL. Return null if the spend is uncapped.
   * @returns `bigint` | `null`
   */
  solSpendLimit(): bigint | null {
    // check for unlimited spend action
    for (const action of this.actions) {
      const limit = action.solControl().spendLimit;
      if (limit === null) {
        return null;
      }
    }
    // get max spend limit, becasue no unlimited action
    return this.actions.reduce(
      (max, val) =>
        val.solControl().spendLimit! > max ? val.solControl().spendLimit! : max,
      0n,
    );
  }

  /**
   * Get Sol {@link SpendController} for the actions
   * @returns SpendController
   */
  solSpend(): SpendController {
    // check for unlimited spend action
    for (const action of this.actions) {
      const limit = action.solControl().spendLimit;
      if (limit === null) {
        return action.solControl();
      }
    }
    // get max spend limit, becasue no unlimited action
    const action = this.actions.find(
      (action) => action.solControl().spendLimit != null,
    );

    return action ? action.solControl() : SpendController.none();
  }

  /**
   * Check if Token Spend is uncapped
   * @param mint Token mint
   * @returns boolean
   */
  canSpendTokenMax(mint: SolPublicKeyData): boolean {
    return !!this.actions.find((action) =>
      action.tokenControl(mint).canSpendMax(),
    );
  }

  /**
   * Check if Token Spend is allowed. If `amount` is provided,
   * it will return `true` if the action can spend the given amoount of Sol
   * @param mint Token mint
   * @param [amount] Minimum spendaable amount
   * @returns boolean
   */
  canSpendToken(mint: SolPublicKeyData, amount?: bigint): boolean {
    return !!this.actions.find((action) =>
      action.tokenControl(mint).canSpend(amount),
    );
  }

  /**
   * Gets the spend limit for a given token mint. Return null if the spend is uncapped.
   * @param mint Token mint
   * @returns `bigint` | `null`
   */
  tokenSpendLimit(mint: SolPublicKeyData): bigint | null {
    // check for unlimited spend action
    for (const action of this.actions) {
      const limit = action.tokenControl(mint).spendLimit;
      if (limit === null) {
        return null;
      }
    }
    // get max spend limit, becasue no unlimited action
    return this.actions.reduce(
      (max, val) =>
        val.tokenControl(mint).spendLimit! > max
          ? val.tokenControl(mint).spendLimit!
          : max,
      0n,
    );
  }

  /**
   * Get token {@link SpendController} for the actions
   * @param mint Token mint
   * @returns SpendController
   */
  tokenSpend(mint: SolPublicKeyData): SpendController {
    // check for unlimited spend action
    for (const action of this.actions) {
      const limit = action.tokenControl(mint).spendLimit;
      if (limit === null) {
        return action.tokenControl(mint);
      }
    }
    // get max spend limit, becasue no unlimited action
    const action = this.actions.find(
      (action) => action.tokenControl(mint).spendLimit != null,
    );

    return action ? action.tokenControl(mint) : SpendController.none();
  }

  /**
   * Get the list of all actions
   */
  getActions(): Action[] {
    return [...this.actions];
  }

  /**
   * Returns normalized actions mirroring on-chain priority behavior.
   *
   * For non-repeatable types, only the first action is kept.
   * For repeatable types with the same resource, only the first is kept.
   *
   * Priority within each category:
   * - SOL Spend: SolLimit > SolRecurringLimit (first wins)
   * - Token Spend: TokenLimit > TokenRecurringLimit per mint
   * - SOL Send: SolDestinationLimit > SolRecurringDestinationLimit per destination
   * - Token Send: TokenDestinationLimit > TokenRecurringDestinationLimit per mint+destination
   * - Stake: StakeAll > StakeLimit > StakeRecurringLimit
   * - Program: ProgramAll > ProgramCurated > specific Programs (NOT ProgramScope)
   * - ProgramScope: All scopes kept (REPEATABLE, keyed by target_account)
   */
  effectiveActions(): EffectiveActions {
    const result: EffectiveActions = {
      manageAuthority: null,
      program: [],
      programScopes: [],
      spend: {
        sol: null,
        tokens: new Map(),
      },
      send: {
        sol: new Map(),
        tokens: new Map(),
      },
      stake: null,
    };

    // Track if we've seen higher-priority types
    let hasProgramAll = false;
    let hasProgramCurated = false;
    let hasStakeAll = false;
    let hasStakeLimit = false;
    let hasSolLimit = false;
    const seenPrograms = new Set<string>();
    const seenTokenMints = new Set<string>();
    const seenSolDestinations = new Set<string>();
    const seenTokenDestinations = new Set<string>();

    for (const action of this.actions) {
      const permission = action.permission;

      // ManageAuthority - first one wins
      if (permission === Permission.ManageAuthority) {
        if (!result.manageAuthority) {
          result.manageAuthority = action;
        }
        continue;
      }

      // Program hierarchy: ProgramAll > ProgramCurated > Program
      if (permission === Permission.ProgramAll) {
        if (!hasProgramAll) {
          hasProgramAll = true;
          result.program = [action];
        }
        continue;
      }

      if (permission === Permission.ProgramCurated) {
        if (!hasProgramAll && !hasProgramCurated) {
          hasProgramCurated = true;
          result.program.push(action);
        }
        continue;
      }

      if (permission === Permission.Program) {
        if (!hasProgramAll) {
          if (isActionPayload(Permission.Program, action['payload'])) {
            const programId = new SolPublicKey(
              new Uint8Array(action['payload'].data.programId),
            ).toBase58();
            // For curated programs, skip if we have ProgramCurated
            if (
              hasProgramCurated &&
              isCuratedProgram(new Uint8Array(action['payload'].data.programId))
            ) {
              continue;
            }
            if (!seenPrograms.has(programId)) {
              seenPrograms.add(programId);
              result.program.push(action);
            }
          }
        }
        continue;
      }

      // ProgramScope - all kept (REPEATABLE by target_account)
      if (permission === Permission.ProgramScope) {
        result.programScopes.push(action);
        continue;
      }

      // Stake hierarchy: StakeAll > StakeLimit > StakeRecurringLimit
      if (permission === Permission.StakeAll) {
        if (!hasStakeAll) {
          hasStakeAll = true;
          result.stake = action;
        }
        continue;
      }

      if (permission === Permission.StakeLimit) {
        if (!hasStakeAll && !hasStakeLimit) {
          hasStakeLimit = true;
          result.stake = action;
        }
        continue;
      }

      if (permission === Permission.StakeRecurringLimit) {
        if (!hasStakeAll && !hasStakeLimit && !result.stake) {
          result.stake = action;
        }
        continue;
      }

      // SOL Spend: SolLimit > SolRecurringLimit
      if (permission === Permission.SolLimit) {
        if (!hasSolLimit) {
          hasSolLimit = true;
          result.spend.sol = action;
        }
        continue;
      }

      if (permission === Permission.SolRecurringLimit) {
        if (!hasSolLimit && !result.spend.sol) {
          result.spend.sol = action;
        }
        continue;
      }

      // Token Spend: TokenLimit > TokenRecurringLimit per mint
      if (
        permission === Permission.TokenLimit ||
        permission === Permission.TokenRecurringLimit
      ) {
        const payload = action['payload'];
        if (
          isActionPayload(Permission.TokenLimit, payload) ||
          isActionPayload(Permission.TokenRecurringLimit, payload)
        ) {
          const mintKey = new SolPublicKey(
            new Uint8Array(payload.data.mint),
          ).toBase58();
          if (!seenTokenMints.has(mintKey)) {
            seenTokenMints.add(mintKey);
            result.spend.tokens.set(mintKey, action);
          } else if (permission === Permission.TokenLimit) {
            // TokenLimit takes priority over TokenRecurringLimit
            const existing = result.spend.tokens.get(mintKey);
            if (existing && existing.permission === Permission.TokenRecurringLimit) {
              result.spend.tokens.set(mintKey, action);
            }
          }
        }
        continue;
      }

      // SOL Send: SolDestinationLimit > SolRecurringDestinationLimit per destination
      if (
        permission === Permission.SolDestinationLimit ||
        permission === Permission.SolRecurringDestinationLimit
      ) {
        const payload = action['payload'];
        if (
          isActionPayload(Permission.SolDestinationLimit, payload) ||
          isActionPayload(Permission.SolRecurringDestinationLimit, payload)
        ) {
          const destKey = new SolPublicKey(
            new Uint8Array(payload.data.destination),
          ).toBase58();
          if (!seenSolDestinations.has(destKey)) {
            seenSolDestinations.add(destKey);
            result.send.sol.set(destKey, action);
          } else if (permission === Permission.SolDestinationLimit) {
            const existing = result.send.sol.get(destKey);
            if (
              existing &&
              existing.permission === Permission.SolRecurringDestinationLimit
            ) {
              result.send.sol.set(destKey, action);
            }
          }
        }
        continue;
      }

      // Token Send: TokenDestinationLimit > TokenRecurringDestinationLimit per mint+destination
      if (
        permission === Permission.TokenDestinationLimit ||
        permission === Permission.TokenRecurringDestinationLimit
      ) {
        const payload = action['payload'];
        if (
          isActionPayload(Permission.TokenDestinationLimit, payload) ||
          isActionPayload(Permission.TokenRecurringDestinationLimit, payload)
        ) {
          const mintKey = new SolPublicKey(
            new Uint8Array(payload.data.mint),
          ).toBase58();
          const destKey = new SolPublicKey(
            new Uint8Array(payload.data.destination),
          ).toBase58();
          const compositeKey = `${mintKey}:${destKey}`;
          if (!seenTokenDestinations.has(compositeKey)) {
            seenTokenDestinations.add(compositeKey);
            result.send.tokens.set(compositeKey, action);
          } else if (permission === Permission.TokenDestinationLimit) {
            const existing = result.send.tokens.get(compositeKey);
            if (
              existing &&
              existing.permission === Permission.TokenRecurringDestinationLimit
            ) {
              result.send.tokens.set(compositeKey, action);
            }
          }
        }
        continue;
      }

      // All and AllButManageAuthority - handle as covering spend, send, stake
      if (
        permission === Permission.All ||
        permission === Permission.AllButManageAuthority
      ) {
        // All covers all spend, send, stake categories
        if (!hasSolLimit && !result.spend.sol) {
          result.spend.sol = action;
          hasSolLimit = true; // Prevent other sol limits from overriding
        }
        if (!hasStakeAll && !hasStakeLimit && !result.stake) {
          result.stake = action;
          hasStakeAll = true; // Prevent other stake limits from overriding
        }
      }
    }

    return result;
  }

  /**
   * Check if this Actions set covers all capabilities in the other set.
   *
   * Semantics: For each category, returns true if every action in `other`
   * for that category is covered by some action in `this`.
   * Vacuously true if `other` has no actions in that category.
   *
   * @param other The Actions set to check coverage for
   * @returns CoverageResult indicating coverage per category
   */
  covers(other: Actions): CoverageResult {
    const thisEffective = this.effectiveActions();
    const otherEffective = other.effectiveActions();

    // Check manageAuthority coverage
    let manageAuthority = true;
    if (otherEffective.manageAuthority) {
      if (!thisEffective.manageAuthority) {
        manageAuthority = false;
      } else {
        manageAuthority = thisEffective.manageAuthority.covers(
          otherEffective.manageAuthority,
        );
      }
    }

    // Check program coverage
    let program = true;
    for (const otherAction of otherEffective.program) {
      let covered = false;
      for (const thisAction of thisEffective.program) {
        if (thisAction.covers(otherAction)) {
          covered = true;
          break;
        }
      }
      if (!covered) {
        // Check if All covers it (it doesn't for program)
        program = false;
        break;
      }
    }

    // Check spend coverage
    let spend = true;
    // Check SOL spend
    if (otherEffective.spend.sol) {
      let solCovered = false;
      // Check if this has All
      if (thisEffective.spend.sol) {
        solCovered = thisEffective.spend.sol.covers(otherEffective.spend.sol);
      }
      if (!solCovered) {
        spend = false;
      }
    }
    // Check token spend
    if (spend) {
      for (const [mintKey, otherAction] of otherEffective.spend.tokens) {
        let tokenCovered = false;
        const thisAction = thisEffective.spend.tokens.get(mintKey);
        if (thisAction && thisAction.covers(otherAction)) {
          tokenCovered = true;
        }
        // Check if this has All (which covers all spend)
        if (
          !tokenCovered &&
          thisEffective.spend.sol &&
          (thisEffective.spend.sol.permission === Permission.All ||
            thisEffective.spend.sol.permission === Permission.AllButManageAuthority)
        ) {
          tokenCovered = true;
        }
        if (!tokenCovered) {
          spend = false;
          break;
        }
      }
    }

    // Check send coverage
    let send = true;
    // Check SOL send
    for (const [destKey, otherAction] of otherEffective.send.sol) {
      let solSendCovered = false;
      const thisAction = thisEffective.send.sol.get(destKey);
      if (thisAction && thisAction.covers(otherAction)) {
        solSendCovered = true;
      }
      // Check if this has SolLimit or All (which covers destination limits)
      if (!solSendCovered && thisEffective.spend.sol) {
        solSendCovered = thisEffective.spend.sol.covers(otherAction);
      }
      if (!solSendCovered) {
        send = false;
        break;
      }
    }
    // Check token send
    if (send) {
      for (const [compositeKey, otherAction] of otherEffective.send.tokens) {
        let tokenSendCovered = false;
        const thisAction = thisEffective.send.tokens.get(compositeKey);
        if (thisAction && thisAction.covers(otherAction)) {
          tokenSendCovered = true;
        }
        // Check if this has TokenLimit or All (which covers destination limits)
        if (!tokenSendCovered) {
          const [mintKey] = compositeKey.split(':');
          const thisTokenLimit = thisEffective.spend.tokens.get(mintKey);
          if (thisTokenLimit && thisTokenLimit.covers(otherAction)) {
            tokenSendCovered = true;
          }
          // Check if All covers it
          if (
            !tokenSendCovered &&
            thisEffective.spend.sol &&
            (thisEffective.spend.sol.permission === Permission.All ||
              thisEffective.spend.sol.permission === Permission.AllButManageAuthority)
          ) {
            tokenSendCovered = true;
          }
        }
        if (!tokenSendCovered) {
          send = false;
          break;
        }
      }
    }

    // Check stake coverage
    let stake = true;
    if (otherEffective.stake) {
      let stakeCovered = false;
      if (thisEffective.stake) {
        stakeCovered = thisEffective.stake.covers(otherEffective.stake);
      }
      if (!stakeCovered) {
        stake = false;
      }
    }

    const full = manageAuthority && program && spend && send && stake;

    return {
      manageAuthority,
      program,
      spend,
      send,
      stake,
      full,
    };
  }

  /**
   * Check if this Actions set is semantically equal to another.
   * Compares effective actions for equality (order-independent).
   *
   * @param other The Actions set to compare with
   * @returns true if the action sets are semantically equal
   */
  equals(other: Actions): boolean {
    const thisEffective = this.effectiveActions();
    const otherEffective = other.effectiveActions();

    // Compare manageAuthority
    if (thisEffective.manageAuthority && otherEffective.manageAuthority) {
      if (!thisEffective.manageAuthority.equals(otherEffective.manageAuthority)) {
        return false;
      }
    } else if (thisEffective.manageAuthority || otherEffective.manageAuthority) {
      return false;
    }

    // Compare program
    if (thisEffective.program.length !== otherEffective.program.length) {
      return false;
    }
    for (const thisAction of thisEffective.program) {
      const found = otherEffective.program.some((otherAction) =>
        thisAction.equals(otherAction),
      );
      if (!found) {
        return false;
      }
    }

    // Compare programScopes
    if (thisEffective.programScopes.length !== otherEffective.programScopes.length) {
      return false;
    }
    for (const thisAction of thisEffective.programScopes) {
      const found = otherEffective.programScopes.some((otherAction) =>
        thisAction.equals(otherAction),
      );
      if (!found) {
        return false;
      }
    }

    // Compare spend.sol
    if (thisEffective.spend.sol && otherEffective.spend.sol) {
      if (!thisEffective.spend.sol.equals(otherEffective.spend.sol)) {
        return false;
      }
    } else if (thisEffective.spend.sol || otherEffective.spend.sol) {
      return false;
    }

    // Compare spend.tokens
    if (thisEffective.spend.tokens.size !== otherEffective.spend.tokens.size) {
      return false;
    }
    for (const [mintKey, thisAction] of thisEffective.spend.tokens) {
      const otherAction = otherEffective.spend.tokens.get(mintKey);
      if (!otherAction || !thisAction.equals(otherAction)) {
        return false;
      }
    }

    // Compare send.sol
    if (thisEffective.send.sol.size !== otherEffective.send.sol.size) {
      return false;
    }
    for (const [destKey, thisAction] of thisEffective.send.sol) {
      const otherAction = otherEffective.send.sol.get(destKey);
      if (!otherAction || !thisAction.equals(otherAction)) {
        return false;
      }
    }

    // Compare send.tokens
    if (thisEffective.send.tokens.size !== otherEffective.send.tokens.size) {
      return false;
    }
    for (const [compositeKey, thisAction] of thisEffective.send.tokens) {
      const otherAction = otherEffective.send.tokens.get(compositeKey);
      if (!otherAction || !thisAction.equals(otherAction)) {
        return false;
      }
    }

    // Compare stake
    if (thisEffective.stake && otherEffective.stake) {
      if (!thisEffective.stake.equals(otherEffective.stake)) {
        return false;
      }
    } else if (thisEffective.stake || otherEffective.stake) {
      return false;
    }

    return true;
  }
}

function deserializeActions(
  actionsBuffer: Uint8Array,
  count: number, // todo: remove count, we are not onchain
): Action[] {
  let cursor = 0;
  const actions: Action[] = [];

  for (let i = 0; i < count; i++) {
    const headerRaw = actionsBuffer.slice(
      cursor,
      cursor + ACTION_HEADER_LENGTH,
    );
    const header = getActionHeaderDecoder().decode(headerRaw);

    cursor += ACTION_HEADER_LENGTH;

    const payloadRaw = actionsBuffer.slice(cursor, header.boundary);

    const payload = decodeActionPayload(header.permission, payloadRaw);

    cursor = header.boundary;

    actions.push(Action.from(header, payload));
  }

  return actions;
}

/**
 * Utility class for a Swig Action
 */
export class Action {
  private constructor(
    private header: ActionHeader,
    private payload: ActionPayload,
  ) {}

  get permission() {
    return this.header.permission;
  }

  static from(header: ActionHeader, payload: ActionPayload): Action {
    return new Action(header, payload);
  }

  isRoot(): boolean {
    return this.permission === Permission.All;
  }

  /**
   * Check if this action can manage authority.
   * Note: All permission does NOT grant authority management.
   * @returns `boolean`
   */
  canManageAuthority(): boolean {
    return this.permission === Permission.ManageAuthority;
  }

  /**
   * Sol Spend controller
   */
  solControl(): SpendController {
    if (isActionPayload(Permission.All, this.payload)) {
      return SpendController.max();
    }

    if (
      isActionPayload(Permission.SolLimit, this.payload) ||
      isActionPayload(Permission.SolRecurringLimit, this.payload) ||
      isActionPayload(Permission.SolDestinationLimit, this.payload) ||
      isActionPayload(Permission.SolRecurringDestinationLimit, this.payload)
    ) {
      return SpendController.get(this.payload);
    }

    return SpendController.none();
  }

  /**
   * Current spendable amount. Returns `null` is spend is uncapped
   */
  solSpendLimit(): bigint | null {
    return this.solControl().spendLimit;
  }

  /**
   * Token Spend controller
   */
  tokenControl(mint: SolPublicKeyData): SpendController {
    if (isActionPayload(Permission.All, this.payload)) {
      return SpendController.max();
    }

    if (
      isActionPayload(Permission.TokenLimit, this.payload) ||
      isActionPayload(Permission.TokenRecurringLimit, this.payload) ||
      isActionPayload(Permission.TokenDestinationLimit, this.payload) ||
      isActionPayload(Permission.TokenRecurringDestinationLimit, this.payload)
    ) {
      if (
        new SolPublicKey(mint).toBase58() ===
        new SolPublicKey(new Uint8Array(this.payload.data.mint)).toBase58()
      ) {
        return SpendController.get(this.payload);
      }
    }

    return SpendController.none();
  }

  /**
   * Check if this action allows using a specific program.
   * Note: All permission does NOT grant program interaction.
   * @param program The program ID to check
   * @returns `boolean`
   */
  canUseProgram(program: SolPublicKeyData): boolean {
    if (isActionPayload(Permission.ProgramAll, this.payload)) {
      return true;
    }

    if (isActionPayload(Permission.ProgramCurated, this.payload)) {
      return isCuratedProgram(program);
    }

    if (isActionPayload(Permission.Program, this.payload)) {
      return (
        new SolPublicKey(program).toBase58() ===
        new SolPublicKey(new Uint8Array(this.payload.data.programId)).toBase58()
      );
    }

    return false;
  }

  /**
   * Check if this action is a program-related action (Program, ProgramAll, ProgramCurated).
   * Note: All permission is NOT a program action.
   * Note: ProgramScope is NOT a program action - it limits account interactions, not program calls.
   * @returns boolean
   */
  hasProgramAction(): boolean {
    return (
      this.permission === Permission.Program ||
      this.permission === Permission.ProgramAll ||
      this.permission === Permission.ProgramCurated
    );
  }

  /**
   * Check if this action is a ProgramScope action.
   * ProgramScope limits interactions with specific target accounts within a program.
   * @returns boolean
   */
  hasProgramScope(): boolean {
    return this.permission === Permission.ProgramScope;
  }

  /**
   * Get ProgramScope data if this action is a ProgramScope action.
   * Returns null if this action is not a ProgramScope.
   *
   * ProgramScope data includes:
   * - programId: The program this scope applies to
   * - targetAccount: The specific account interactions are limited to
   * - limit: The spending/interaction limit
   * - window: Time window for recurring limits
   * - scopeType: Basic, Limit, or RecurringLimit
   * - numericType: The numeric type for balance field parsing
   * - balance_field_start/end: Byte offsets for reading balance from account data
   *
   * @returns ProgramScope data or null
   */
  getProgramScopeData(): {
    programId: Uint8Array;
    targetAccount: Uint8Array;
    limit: bigint;
    window: bigint;
    scopeType: number;
    numericType: number;
    balance_field_start: bigint;
    balance_field_end: bigint;
    currentAmount: bigint;
    lastReset: bigint;
  } | null {
    if (!isActionPayload(Permission.ProgramScope, this.payload)) {
      return null;
    }
    return {
      programId: new Uint8Array(this.payload.data.programId),
      targetAccount: new Uint8Array(this.payload.data.targetAccount),
      limit: this.payload.data.limit,
      window: this.payload.data.window,
      scopeType: this.payload.data.scopeType,
      numericType: this.payload.data.numericType,
      balance_field_start: this.payload.data.balance_field_start,
      balance_field_end: this.payload.data.balance_field_end,
      currentAmount: this.payload.data.currentAmount,
      lastReset: this.payload.data.lastReset,
    };
  }

  /**
   * Check if this ProgramScope action matches a specific target account.
   * @param targetAccount The target account to check
   * @returns true if this is a ProgramScope for the given target account
   */
  matchesTargetAccount(targetAccount: SolPublicKeyData): boolean {
    if (!isActionPayload(Permission.ProgramScope, this.payload)) {
      return false;
    }
    return (
      new SolPublicKey(targetAccount).toBase58() ===
      new SolPublicKey(new Uint8Array(this.payload.data.targetAccount)).toBase58()
    );
  }

  /**
   * Check if this action covers (can do everything) another action can do.
   *
   * Coverage rules:
   * - All covers: spend, send, stake (NOT programs, NOT manageAuthority)
   * - AllButManageAuthority: same as All
   * - Same type: higher/equal amount covers lower
   * - Cross-type within category:
   *   - SolLimit covers SolDestinationLimit, SolRecurringLimit
   *   - TokenLimit covers TokenDestinationLimit, TokenRecurringLimit (same mint)
   *   - StakeAll covers StakeLimit, StakeRecurringLimit
   *   - ProgramAll > ProgramCurated > Program
   *
   * @param other The action to check coverage for
   * @returns true if this action can do everything the other action can
   */
  covers(other: Action): boolean {
    const thisCategory = getPermissionCategory(this.permission);
    const otherCategory = getPermissionCategory(other.permission);

    // Handle All and AllButManageAuthority
    if (
      this.permission === Permission.All ||
      this.permission === Permission.AllButManageAuthority
    ) {
      // All covers spend, send, stake
      if (
        otherCategory === 'spend' ||
        otherCategory === 'send' ||
        otherCategory === 'stake'
      ) {
        return true;
      }
      // All does NOT cover program, manageAuthority, or programScope
      return false;
    }

    // Same permission type - compare amounts
    if (this.permission === other.permission) {
      return this.coversSameType(other);
    }

    // Cross-type coverage within same category
    return this.coversCrossType(other);
  }

  /**
   * Compare two actions of the same permission type
   */
  private coversSameType(other: Action): boolean {
    switch (this.permission) {
      // Payloadless types always equal
      case Permission.All:
      case Permission.AllButManageAuthority:
      case Permission.ManageAuthority:
      case Permission.ProgramAll:
      case Permission.StakeAll:
        return true;

      // SOL limits - compare amounts
      case Permission.SolLimit:
        if (
          isActionPayload(Permission.SolLimit, this.payload) &&
          isActionPayload(Permission.SolLimit, other.payload)
        ) {
          return this.payload.data.amount >= other.payload.data.amount;
        }
        return false;

      case Permission.SolRecurringLimit:
        if (
          isActionPayload(Permission.SolRecurringLimit, this.payload) &&
          isActionPayload(Permission.SolRecurringLimit, other.payload)
        ) {
          // Compare recurringAmount (configuration), not currentAmount (runtime)
          return (
            this.payload.data.recurringAmount >=
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      case Permission.SolDestinationLimit:
        if (
          isActionPayload(Permission.SolDestinationLimit, this.payload) &&
          isActionPayload(Permission.SolDestinationLimit, other.payload)
        ) {
          // Must be same destination
          if (
            !bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            )
          ) {
            return false;
          }
          return this.payload.data.amount >= other.payload.data.amount;
        }
        return false;

      case Permission.SolRecurringDestinationLimit:
        if (
          isActionPayload(Permission.SolRecurringDestinationLimit, this.payload) &&
          isActionPayload(Permission.SolRecurringDestinationLimit, other.payload)
        ) {
          // Must be same destination
          if (
            !bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            )
          ) {
            return false;
          }
          return (
            this.payload.data.recurringAmount >=
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      // Token limits - must match mint
      case Permission.TokenLimit:
        if (
          isActionPayload(Permission.TokenLimit, this.payload) &&
          isActionPayload(Permission.TokenLimit, other.payload)
        ) {
          if (!bytesEqual(this.payload.data.mint, other.payload.data.mint)) {
            return false;
          }
          return this.payload.data.amount >= other.payload.data.amount;
        }
        return false;

      case Permission.TokenRecurringLimit:
        if (
          isActionPayload(Permission.TokenRecurringLimit, this.payload) &&
          isActionPayload(Permission.TokenRecurringLimit, other.payload)
        ) {
          if (!bytesEqual(this.payload.data.mint, other.payload.data.mint)) {
            return false;
          }
          return (
            this.payload.data.recurringAmount >=
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      case Permission.TokenDestinationLimit:
        if (
          isActionPayload(Permission.TokenDestinationLimit, this.payload) &&
          isActionPayload(Permission.TokenDestinationLimit, other.payload)
        ) {
          // Must be same mint and destination
          if (
            !bytesEqual(this.payload.data.mint, other.payload.data.mint) ||
            !bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            )
          ) {
            return false;
          }
          return this.payload.data.amount >= other.payload.data.amount;
        }
        return false;

      case Permission.TokenRecurringDestinationLimit:
        if (
          isActionPayload(Permission.TokenRecurringDestinationLimit, this.payload) &&
          isActionPayload(Permission.TokenRecurringDestinationLimit, other.payload)
        ) {
          // Must be same mint and destination
          if (
            !bytesEqual(this.payload.data.mint, other.payload.data.mint) ||
            !bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            )
          ) {
            return false;
          }
          return (
            this.payload.data.recurringAmount >=
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      // Stake limits
      case Permission.StakeLimit:
        if (
          isActionPayload(Permission.StakeLimit, this.payload) &&
          isActionPayload(Permission.StakeLimit, other.payload)
        ) {
          return this.payload.data.amount >= other.payload.data.amount;
        }
        return false;

      case Permission.StakeRecurringLimit:
        if (
          isActionPayload(Permission.StakeRecurringLimit, this.payload) &&
          isActionPayload(Permission.StakeRecurringLimit, other.payload)
        ) {
          return (
            this.payload.data.recurringAmount >=
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      // Program types
      case Permission.ProgramCurated:
        // ProgramCurated covers ProgramCurated (same permissions)
        return true;

      case Permission.Program:
        if (
          isActionPayload(Permission.Program, this.payload) &&
          isActionPayload(Permission.Program, other.payload)
        ) {
          // Must be same programId
          return bytesEqual(
            this.payload.data.programId,
            other.payload.data.programId,
          );
        }
        return false;

      // ProgramScope - must match target account
      case Permission.ProgramScope:
        if (
          isActionPayload(Permission.ProgramScope, this.payload) &&
          isActionPayload(Permission.ProgramScope, other.payload)
        ) {
          // Must be same target account
          if (
            !bytesEqual(
              this.payload.data.targetAccount,
              other.payload.data.targetAccount,
            )
          ) {
            return false;
          }
          // Compare limits
          return this.payload.data.limit >= other.payload.data.limit;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Check cross-type coverage (e.g., SolLimit covering SolDestinationLimit)
   */
  private coversCrossType(other: Action): boolean {
    // Program hierarchy: ProgramAll > ProgramCurated > Program
    if (this.permission === Permission.ProgramAll) {
      return (
        other.permission === Permission.ProgramCurated ||
        other.permission === Permission.Program
      );
    }

    if (this.permission === Permission.ProgramCurated) {
      if (other.permission === Permission.Program) {
        // ProgramCurated covers Program only if it's a curated program
        if (isActionPayload(Permission.Program, other.payload)) {
          return isCuratedProgram(new Uint8Array(other.payload.data.programId));
        }
      }
      return false;
    }

    // Stake hierarchy: StakeAll > StakeLimit, StakeRecurringLimit
    if (this.permission === Permission.StakeAll) {
      return (
        other.permission === Permission.StakeLimit ||
        other.permission === Permission.StakeRecurringLimit
      );
    }

    // SOL: SolLimit covers SolDestinationLimit (any destination) and SolRecurringLimit
    if (this.permission === Permission.SolLimit) {
      if (isActionPayload(Permission.SolLimit, this.payload)) {
        if (other.permission === Permission.SolDestinationLimit) {
          if (isActionPayload(Permission.SolDestinationLimit, other.payload)) {
            return this.payload.data.amount >= other.payload.data.amount;
          }
        }
        if (other.permission === Permission.SolRecurringLimit) {
          if (isActionPayload(Permission.SolRecurringLimit, other.payload)) {
            return this.payload.data.amount >= other.payload.data.recurringAmount;
          }
        }
        if (other.permission === Permission.SolRecurringDestinationLimit) {
          if (
            isActionPayload(Permission.SolRecurringDestinationLimit, other.payload)
          ) {
            return this.payload.data.amount >= other.payload.data.recurringAmount;
          }
        }
      }
      return false;
    }

    // Token: TokenLimit covers TokenDestinationLimit (same mint) and TokenRecurringLimit
    if (this.permission === Permission.TokenLimit) {
      if (isActionPayload(Permission.TokenLimit, this.payload)) {
        if (other.permission === Permission.TokenDestinationLimit) {
          if (isActionPayload(Permission.TokenDestinationLimit, other.payload)) {
            if (!bytesEqual(this.payload.data.mint, other.payload.data.mint)) {
              return false;
            }
            return this.payload.data.amount >= other.payload.data.amount;
          }
        }
        if (other.permission === Permission.TokenRecurringLimit) {
          if (isActionPayload(Permission.TokenRecurringLimit, other.payload)) {
            if (!bytesEqual(this.payload.data.mint, other.payload.data.mint)) {
              return false;
            }
            return this.payload.data.amount >= other.payload.data.recurringAmount;
          }
        }
        if (other.permission === Permission.TokenRecurringDestinationLimit) {
          if (
            isActionPayload(Permission.TokenRecurringDestinationLimit, other.payload)
          ) {
            if (!bytesEqual(this.payload.data.mint, other.payload.data.mint)) {
              return false;
            }
            return this.payload.data.amount >= other.payload.data.recurringAmount;
          }
        }
      }
      return false;
    }

    return false;
  }

  /**
   * Check if this action equals another action semantically.
   * Compares permission type and configuration fields, ignoring runtime state
   * like currentAmount, lastReset, etc.
   *
   * @param other The action to compare with
   * @returns true if the actions are semantically equal
   */
  equals(other: Action): boolean {
    if (this.permission !== other.permission) return false;

    switch (this.permission) {
      // Payloadless types
      case Permission.All:
      case Permission.AllButManageAuthority:
      case Permission.ManageAuthority:
      case Permission.ProgramAll:
      case Permission.StakeAll:
        return true;

      // SOL limits - compare configuration only
      case Permission.SolLimit:
        if (
          isActionPayload(Permission.SolLimit, this.payload) &&
          isActionPayload(Permission.SolLimit, other.payload)
        ) {
          return this.payload.data.amount === other.payload.data.amount;
        }
        return false;

      case Permission.SolRecurringLimit:
        if (
          isActionPayload(Permission.SolRecurringLimit, this.payload) &&
          isActionPayload(Permission.SolRecurringLimit, other.payload)
        ) {
          // Compare configuration fields only (recurringAmount, window)
          // NOT runtime fields (currentAmount, lastReset)
          return (
            this.payload.data.recurringAmount ===
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      case Permission.SolDestinationLimit:
        if (
          isActionPayload(Permission.SolDestinationLimit, this.payload) &&
          isActionPayload(Permission.SolDestinationLimit, other.payload)
        ) {
          return (
            bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            ) && this.payload.data.amount === other.payload.data.amount
          );
        }
        return false;

      case Permission.SolRecurringDestinationLimit:
        if (
          isActionPayload(Permission.SolRecurringDestinationLimit, this.payload) &&
          isActionPayload(Permission.SolRecurringDestinationLimit, other.payload)
        ) {
          return (
            bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            ) &&
            this.payload.data.recurringAmount ===
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      // Token limits
      case Permission.TokenLimit:
        if (
          isActionPayload(Permission.TokenLimit, this.payload) &&
          isActionPayload(Permission.TokenLimit, other.payload)
        ) {
          return (
            bytesEqual(this.payload.data.mint, other.payload.data.mint) &&
            this.payload.data.amount === other.payload.data.amount
          );
        }
        return false;

      case Permission.TokenRecurringLimit:
        if (
          isActionPayload(Permission.TokenRecurringLimit, this.payload) &&
          isActionPayload(Permission.TokenRecurringLimit, other.payload)
        ) {
          return (
            bytesEqual(this.payload.data.mint, other.payload.data.mint) &&
            this.payload.data.recurringAmount ===
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      case Permission.TokenDestinationLimit:
        if (
          isActionPayload(Permission.TokenDestinationLimit, this.payload) &&
          isActionPayload(Permission.TokenDestinationLimit, other.payload)
        ) {
          return (
            bytesEqual(this.payload.data.mint, other.payload.data.mint) &&
            bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            ) &&
            this.payload.data.amount === other.payload.data.amount
          );
        }
        return false;

      case Permission.TokenRecurringDestinationLimit:
        if (
          isActionPayload(Permission.TokenRecurringDestinationLimit, this.payload) &&
          isActionPayload(Permission.TokenRecurringDestinationLimit, other.payload)
        ) {
          return (
            bytesEqual(this.payload.data.mint, other.payload.data.mint) &&
            bytesEqual(
              this.payload.data.destination,
              other.payload.data.destination,
            ) &&
            this.payload.data.recurringAmount ===
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      // Stake limits
      case Permission.StakeLimit:
        if (
          isActionPayload(Permission.StakeLimit, this.payload) &&
          isActionPayload(Permission.StakeLimit, other.payload)
        ) {
          return this.payload.data.amount === other.payload.data.amount;
        }
        return false;

      case Permission.StakeRecurringLimit:
        if (
          isActionPayload(Permission.StakeRecurringLimit, this.payload) &&
          isActionPayload(Permission.StakeRecurringLimit, other.payload)
        ) {
          return (
            this.payload.data.recurringAmount ===
              other.payload.data.recurringAmount &&
            this.payload.data.window === other.payload.data.window
          );
        }
        return false;

      // Program types
      case Permission.ProgramCurated:
        return true; // No payload to compare

      case Permission.Program:
        if (
          isActionPayload(Permission.Program, this.payload) &&
          isActionPayload(Permission.Program, other.payload)
        ) {
          return bytesEqual(
            this.payload.data.programId,
            other.payload.data.programId,
          );
        }
        return false;

      case Permission.ProgramScope:
        if (
          isActionPayload(Permission.ProgramScope, this.payload) &&
          isActionPayload(Permission.ProgramScope, other.payload)
        ) {
          // Compare configuration fields, not runtime state
          return (
            bytesEqual(
              this.payload.data.programId,
              other.payload.data.programId,
            ) &&
            bytesEqual(
              this.payload.data.targetAccount,
              other.payload.data.targetAccount,
            ) &&
            this.payload.data.limit === other.payload.data.limit &&
            this.payload.data.window === other.payload.data.window &&
            this.payload.data.scopeType === other.payload.data.scopeType &&
            this.payload.data.numericType === other.payload.data.numericType &&
            this.payload.data.balance_field_start ===
              other.payload.data.balance_field_start &&
            this.payload.data.balance_field_end ===
              other.payload.data.balance_field_end
          );
        }
        return false;

      case Permission.SubAccount:
        if (
          isActionPayload(Permission.SubAccount, this.payload) &&
          isActionPayload(Permission.SubAccount, other.payload)
        ) {
          return bytesEqual(
            this.payload.data.subAccount,
            other.payload.data.subAccount,
          );
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get the permission category for this action
   */
  getCategory(): PermissionCategory {
    return getPermissionCategory(this.permission);
  }
}
