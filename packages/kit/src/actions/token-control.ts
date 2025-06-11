import { isTokenAction, type TokenAction } from '@swig/coder';

export class SwigTokenControl {
  private constructor(private readonly tokenControl: TokenControl) {}

  get amount(): bigint | null {
    return this.tokenControl.amount;
  }

  get window(): bigint | null {
    return this.tokenControl.window || null;
  }

  get last(): bigint | null {
    return this.tokenControl.last || null;
  }

  get isAllowed(): boolean {
    return this.tokenControl.hasControl;
  }

  canSpendMax(): boolean {
    return this.isAllowed && this.amount === null;
  }

  canSpend(amount?: bigint): boolean {
    if (!amount) return this.isAllowed;
    return this.isAllowed && this.withinLimits(amount);
  }

  private withinLimits(amount: bigint): boolean {
    return this.amount === null || this.amount >= amount;
  }

  static get(tokenAction: TokenAction): SwigTokenControl {
    if (isTokenAction('Temporal', tokenAction)) {
      return SwigTokenControl.temporal({
        amount: tokenAction.fields[0],
        window: tokenAction.fields[1],
        last: tokenAction.fields[2],
      });
    }

    if (isTokenAction('Manage', tokenAction)) {
      return SwigTokenControl.manage(tokenAction.fields[0]);
    }

    if (isTokenAction('All', tokenAction)) {
      return SwigTokenControl.all();
    }

    return SwigTokenControl.noControl();
  }

  static noControl(): SwigTokenControl {
    return new SwigTokenControl({
      hasControl: false,
      amount: null,
    });
  }

  static all(): SwigTokenControl {
    return new SwigTokenControl({
      hasControl: true,
      amount: null,
    });
  }

  static manage(amount: bigint): SwigTokenControl {
    return new this({
      hasControl: true,
      amount,
    });
  }

  static temporal(args: {
    amount: bigint;
    window: bigint;
    last: bigint;
  }): SwigTokenControl {
    return new this({
      ...args,
      hasControl: true,
    });
  }
}

export type TokenControl = {
  hasControl: boolean;
  amount: bigint | null;
  window?: bigint;
  last?: bigint;
};
