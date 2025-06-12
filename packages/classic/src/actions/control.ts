import { Permission } from '@swig-wallet/coder';
import { isActionPayload, type ActionPayload } from './payload';

export class SpendController {
  private constructor(private readonly spendControl: SpendControl) {}

  get isAllowed(): boolean {
    return this.spendControl.hasControl;
  }
  /**
   * max spendable amount.
   *
   * returns `null` if there is no limit
   */
  get spendLimit(): bigint | null {
    if (!this.isAllowed) return 0n;
    return this.spendControl.amount;
  }

  get window(): bigint | null {
    return this.spendControl.window ?? null;
  }

  get lastReset(): bigint | undefined {
    return this.spendControl.lastReset;
  }

  get recurringLimit(): bigint | undefined {
    return this.spendControl.recurringAmount;
  }

  /**
   * Check if a spend in uncapped
   * @returns boolean
   */
  canSpendMax(): boolean {
    return this.spendLimit === null;
  }

  /**
   * Check if allowed to spend a given amount, or spend at all if no amount is provided
   * @param amount Token amount
   * @returns boolean
   */
  canSpend(amount?: bigint): boolean {
    return amount ? this.withinLimits(amount) : this.isAllowed;
  }

  private withinLimits(amount: bigint): boolean {
    return (
      this.isAllowed && (this.spendLimit === null || this.spendLimit >= amount)
    );
  }

  static get(action: ActionPayload): SpendController {
    if (
      isActionPayload(Permission.SolRecurringLimit, action) ||
      isActionPayload(Permission.TokenRecurringLimit, action)
    ) {
      return SpendController.recurring({
        amount: action.data.currentAmount,
        ...action.data,
      });
    }

    if (
      isActionPayload(Permission.SolLimit, action) ||
      isActionPayload(Permission.TokenLimit, action)
    ) {
      return SpendController.once(action.data.amount);
    }

    if (isActionPayload(Permission.All, action)) {
      return SpendController.max();
    }

    return SpendController.none();
  }

  static none(): SpendController {
    return new SpendController({
      hasControl: false,
      amount: null,
    });
  }

  /**
   *  Spend Max controller
   */
  static max(): SpendController {
    return new SpendController({
      hasControl: true,
      amount: null,
    });
  }

  /**
   * Spend Once controller
   */
  static once(amount: bigint): SpendController {
    return new this({
      hasControl: true,
      amount,
    });
  }

  /**
   * Spend Recurring controller
   */
  static recurring(args: {
    amount: bigint;
    window: bigint;
    lastReset: bigint;
    recurringAmount: bigint;
  }): SpendController {
    return new this({
      ...args,
      hasControl: true,
    });
  }
}

export type SpendControl = {
  /**
   * `true` if the action is allowed to spend at all
   */
  hasControl: boolean;
  /**
   * amount the action is permitted to spend at the given moment, `null` if spend is uncapped
   */
  amount: bigint | null;
  /**
   * time in slots between between spend topups. This is only available for Recurring Spends
   */
  window?: bigint;
  /**
   * The time in slot where the last topup happened. Only valid for recurring spends
   */
  lastReset?: bigint;
  /**
   * The max spend after a topup
   */
  recurringAmount?: bigint;
};
