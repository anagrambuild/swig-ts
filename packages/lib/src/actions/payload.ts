import type {
  ProgramCurated,
  ProgramLimit,
  ProgramScope,
  SolDestinationLimit,
  SolLimit,
  SolRecurringDestinationLimit,
  SolRecurringLimit,
  StakeLimit,
  StakeRecurringLimit,
  SubAccount,
  TokenDestinationLimit,
  TokenLimit,
  TokenRecurringDestinationLimit,
  TokenRecurringLimit,
} from '@swig-wallet/coder';
import {
  getProgramCuratedDecoder,
  getProgramLimitDecoder,
  getProgramScopeDecoder,
  getSolDestinationLimitDecoder,
  getSolLimitDecoder,
  getSolRecurringDestinationLimitDecoder,
  getSolRecurringLimitDecoder,
  getStakeLimitDecoder,
  getStakeRecurringLimitDecoder,
  getSubAccountDecoder,
  getTokenDestinationLimitDecoder,
  getTokenLimitDecoder,
  getTokenRecurringDestinationLimitDecoder,
  getTokenRecurringLimitDecoder,
  Permission,
} from '@swig-wallet/coder';

export type ActionPayload =
  | { permission: Permission.All }
  | {
      permission: Permission.AllButManageAuthority;
    }
  | {
      permission: Permission.ManageAuthority;
    }
  | {
      permission: Permission.Program;
      data: ProgramLimit;
    }
  | {
      permission: Permission.ProgramAll;
    }
  | {
      permission: Permission.ProgramCurated;
      data: ProgramCurated;
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
      permission: Permission.SolDestinationLimit;
      data: SolDestinationLimit;
    }
  | {
      permission: Permission.SolRecurringDestinationLimit;
      data: SolRecurringDestinationLimit;
    }
  | {
      permission: Permission.StakeAll;
    }
  | {
      permission: Permission.StakeLimit;
      data: StakeLimit;
    }
  | {
      permission: Permission.StakeRecurringLimit;
      data: StakeRecurringLimit;
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
    }
  | {
      permission: Permission.TokenDestinationLimit;
      data: TokenDestinationLimit;
    }
  | {
      permission: Permission.TokenRecurringDestinationLimit;
      data: TokenRecurringDestinationLimit;
    }
  | {
      permission: Permission.CloseSwigAuthority;
    }
  | {
      permission: Permission.RentDestination;
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

  if (permission === Permission.ProgramAll) {
    return { permission };
  }

  if (permission === Permission.ProgramCurated) {
    return { permission, data: getProgramCuratedDecoder().decode(data) };
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

  if (permission === Permission.StakeAll) {
    return { permission };
  }

  if (permission === Permission.StakeLimit) {
    return { permission, data: getStakeLimitDecoder().decode(data) };
  }

  if (permission === Permission.StakeRecurringLimit) {
    return { permission, data: getStakeRecurringLimitDecoder().decode(data) };
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

  if (permission === Permission.SolDestinationLimit) {
    return { permission, data: getSolDestinationLimitDecoder().decode(data) };
  }

  if (permission === Permission.SolRecurringDestinationLimit) {
    return {
      permission,
      data: getSolRecurringDestinationLimitDecoder().decode(data),
    };
  }

  if (permission === Permission.TokenDestinationLimit) {
    return { permission, data: getTokenDestinationLimitDecoder().decode(data) };
  }

  if (permission === Permission.TokenRecurringDestinationLimit) {
    return {
      permission,
      data: getTokenRecurringDestinationLimitDecoder().decode(data),
    };
  }

  if (permission === Permission.AllButManageAuthority) {
    return { permission };
  }

  if (permission === Permission.CloseSwigAuthority) {
    return { permission };
  }

  if (permission === Permission.RentDestination) {
    return { permission };
  }

  throw new Error('Invalid Permission');
}
