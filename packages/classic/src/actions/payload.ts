import type {
  ProgramLimit,
  ProgramScope,
  SolLimit,
  SolRecurringLimit,
  SubAccount,
  TokenLimit,
  TokenRecurringLimit,
} from '@swig-wallet/coder';
import {
  getProgramLimitDecoder,
  getProgramScopeDecoder,
  getSolLimitDecoder,
  getSolRecurringLimitDecoder,
  getSubAccountDecoder,
  getTokenLimitDecoder,
  getTokenRecurringLimitDecoder,
  Permission,
} from '@swig-wallet/coder';

export type ActionPayload =
  | { permission: Permission.All }
  | {
      permission: Permission.ManageAuthority;
    }
  | {
      permission: Permission.Program;
      data: ProgramLimit;
    }
  | {
      permission: Permission.ProgramScope;
      data: ProgramScope;
    }
  | {
      permission: Permission.SolLimit;
      data: SolLimit;
    }
  | {
      permission: Permission.SolRecurringLimit;
      data: SolRecurringLimit;
    }
  | {
      permission: Permission.SubAccount;
      data: SubAccount;
    }
  | {
      permission: Permission.TokenLimit;
      data: TokenLimit;
    }
  | {
      permission: Permission.TokenRecurringLimit;
      data: TokenRecurringLimit;
    };

export function isActionPayload<P extends ActionPayload['permission']>(
  permission: P,
  action: ActionPayload,
): action is ActionPayload & { permission: P } {
  return permission === action.permission;
}

export function decodeActionPayload(
  permission: Permission,
  data: Uint8Array,
): ActionPayload {
  if (permission === Permission.All) {
    return { permission };
  }

  if (permission === Permission.ManageAuthority) {
    return { permission };
  }

  if (permission === Permission.Program) {
    return { permission, data: getProgramLimitDecoder().decode(data) };
  }

  if (permission === Permission.ProgramScope) {
    return { permission, data: getProgramScopeDecoder().decode(data) };
  }

  if (permission === Permission.SolLimit) {
    return { permission, data: getSolLimitDecoder().decode(data) };
  }

  if (permission === Permission.SolRecurringLimit) {
    return { permission, data: getSolRecurringLimitDecoder().decode(data) };
  }

  if (permission === Permission.SubAccount) {
    return { permission, data: getSubAccountDecoder().decode(data) };
  }

  if (permission === Permission.TokenLimit) {
    return { permission, data: getTokenLimitDecoder().decode(data) };
  }

  if (permission === Permission.TokenRecurringLimit) {
    return { permission, data: getTokenRecurringLimitDecoder().decode(data) };
  }

  throw new Error('Invalid Permission');
}
