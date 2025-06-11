import { address, type Address } from '@solana/kit';
import { isAction, type Action, type ActionKind } from '@swig/coder';
import { SwigActionsBuilder } from './builder';
import { SwigTokenControl } from './token-control';

export class SwigAction {
  constructor(private readonly action: Action) {}

  get kind(): ActionKind {
    return this.action.__kind;
  }

  isKind(kind: ActionKind) {
    return this.action.__kind === kind;
  }

  isAll(): boolean {
    return this.kind === 'All';
  }

  canManageAuthority() {
    return this.kind === 'All' || this.kind === 'ManageAuthority';
  }

  solControl(): SwigTokenControl {
    if (isAction('All', this.action)) {
      return SwigTokenControl.all();
    }

    if (isAction('Sol', this.action)) {
      return SwigTokenControl.get(this.action.action);
    }

    return SwigTokenControl.noControl();
  }

  allTokensControl(): SwigTokenControl {
    if (isAction('All', this.action)) {
      return SwigTokenControl.all();
    }

    if (isAction('Tokens', this.action)) {
      return SwigTokenControl.get(this.action.action);
    }

    return SwigTokenControl.noControl();
  }

  tokenControl(token: Address): SwigTokenControl {
    if (isAction('All', this.action)) {
      return SwigTokenControl.all();
    }

    if (isAction('Tokens', this.action)) {
      return SwigTokenControl.get(this.action.action);
    }

    if (isAction('Token', this.action)) {
      if (token === address(this.action.key))
        return SwigTokenControl.get(this.action.action);
    }

    return SwigTokenControl.noControl();
  }

  canUseProgram(program: Address): boolean {
    if (isAction('All', this.action)) {
      return true;
    }

    if (isAction('Program', this.action)) {
      if (program === address(this.action.key)) return true;
    }

    return false;
  }
}

export class SwigActions {
  private readonly actions: SwigAction[];

  constructor(private readonly _actions: Action[]) {
    this.actions = _actions.map((action) => new SwigAction(action));
  }

  static set(): SwigActionsBuilder {
    return SwigActionsBuilder.new();
  }

  rawActions(): Action[] {
    return this._actions;
  }

  hasAllAction(): boolean {
    return !!this.actions.find((action) => action.isAll());
  }

  canManageAuthority(): boolean {
    return !!this.actions.find((action) => action.canManageAuthority());
  }

  canUseProgram(programId: Address): boolean {
    return !!this.actions.find((action) => action.canUseProgram(programId));
  }

  canSpendSolMax(): boolean {
    return !!this.actions.find((action) => action.solControl().canSpendMax());
  }

  canSpendSol(amount?: bigint): boolean {
    return !!this.actions.find((action) =>
      action.solControl().canSpend(amount),
    );
  }

  canSpendAllTokensMax(): boolean {
    return !!this.actions.find((action) =>
      action.allTokensControl().canSpendMax(),
    );
  }

  canSpendAllTokens(amount?: bigint): boolean {
    return !!this.actions.find((action) =>
      action.allTokensControl().canSpend(amount),
    );
  }

  canSpendTokenMax(mint: Address): boolean {
    return !!this.actions.find((action) =>
      action.tokenControl(mint).canSpendMax(),
    );
  }

  canSpendToken(mint: Address, amount?: bigint): boolean {
    return !!this.actions.find((action) =>
      action.tokenControl(mint).canSpend(amount),
    );
  }
}
