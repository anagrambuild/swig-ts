import type { Address } from '@solana/kit';
import {
  Actions,
  getAddAuthorityInstructionContext,
  getCreateSessionInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getRemoveAuthorityInstructionContext,
  getSignInstructionContext,
  getToggleSubAccountInstructionContext,
  getWithdrawFromSubAccountCheckedInstructionContext,
  getWithdrawFromSubAccountInstructionContext,
  SolInstruction,
  Swig,
  SwigInstructionContext,
  type CreateAuthorityInfo,
  type KitInstruction,
  type SwigOptions,
  type WithdrawSubAccountArgs,
  type WithdrawSubAccountCheckedArgs,
} from '@swig-wallet/lib';

export async function getCreateSwigInstruction(args: {
  payer: Address;
  id: Uint8Array;
  actions: Actions;
  authorityInfo: CreateAuthorityInfo;
}): Promise<KitInstruction> {
  const context = await getCreateSwigInstructionContext(args);
  return getInstructionsFromContext(context)[0];
}

export async function getAddAuthorityInstructions(
  swig: Swig,
  roleId: number,
  newAuthorityInfo: CreateAuthorityInfo,
  actions: Actions,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getAddAuthorityInstructionContext(
    swig,
    roleId,
    newAuthorityInfo,
    actions,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getRemoveAuthorityInstructions(
  swig: Swig,
  roleId: number,
  roleToRemoveId: number,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getRemoveAuthorityInstructionContext(
    swig,
    roleId,
    roleToRemoveId,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getSignInstructions(
  swig: Swig,
  roleId: number,
  instructions: KitInstruction[],
  withSubAccount?: boolean,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getSignInstructionContext(
    swig,
    roleId,
    instructions.map(SolInstruction.from),
    withSubAccount,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getCreateSessionInstructions(
  swig: Swig,
  roleId: number,
  sessionKey: Address,
  duration?: bigint,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getCreateSessionInstructionContext(
    swig,
    roleId,
    sessionKey,
    duration,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getCreateSubAccountInstructions(
  swig: Swig,
  roleId: number,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getCreateSubAccountInstructionContext(
    swig,
    roleId,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getToggleSubAccountInstructions(
  swig: Swig,
  roleId: number,
  enabled: boolean,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getToggleSubAccountInstructionContext(
    swig,
    roleId,
    enabled,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getWithdrawFromSubAccountSubAccountInstructions(
  swig: Swig,
  roleId: number,
  withdrawArgs: WithdrawSubAccountArgs<Address>,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getWithdrawFromSubAccountInstructionContext(
    swig,
    roleId,
    withdrawArgs,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getWithdrawFromSubAccountSubAccountInstructionsChecked(
  swig: Swig,
  roleId: number,
  withdrawArgs: WithdrawSubAccountCheckedArgs<Address>,
  options?: SwigOptions,
): Promise<KitInstruction[]> {
  const context = await getWithdrawFromSubAccountCheckedInstructionContext(
    swig,
    roleId,
    withdrawArgs,
    options,
  );

  return getInstructionsFromContext(context);
}

export function getInstructionsFromContext(
  swigContext: SwigInstructionContext,
): KitInstruction[] {
  return swigContext.getKitInstructions();
}
