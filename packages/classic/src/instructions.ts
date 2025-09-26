import { PublicKey, type TransactionInstruction } from '@solana/web3.js';
import {
  Actions,
  AddMultipleAuthoritiesInstructionContextBuilder,
  getAddAuthorityInstructionContext,
  getAddMultipleAuthoritiesInstructionsContextBuilder,
  getCreateSessionInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getCreateSwigWithMultipleAuthoritiesInstructionContextBuilder,
  getRemoveAuthorityInstructionContext,
  getSignInstructionContext,
  getToggleSubAccountInstructionContext,
  getTransferAssetsInstructionContext,
  getWithdrawFromSubAccountCheckedInstructionContext,
  getWithdrawFromSubAccountInstructionContext,
  SolInstruction,
  Swig,
  SwigInstructionContext,
  type CreateAuthorityInfo,
  type SigningFn,
  type SwigOptions,
  type Web3Instruction,
  type WithdrawSubAccountArgs,
  type WithdrawSubAccountCheckedArgs,
} from '@swig-wallet/lib';

export async function getCreateSwigInstruction(args: {
  payer: PublicKey;
  id: Uint8Array;
  actions: Actions;
  authorityInfo: CreateAuthorityInfo;
}): Promise<TransactionInstruction> {
  const context = await getCreateSwigInstructionContext(args);
  return getInstructionsFromContext(context)[0];
}

export async function getAddAuthorityInstructions(
  swig: Swig,
  roleId: number,
  newAuthorityInfo: CreateAuthorityInfo,
  actions: Actions,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
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
): Promise<TransactionInstruction[]> {
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
  instructions: TransactionInstruction[],
  withSubAccount?: boolean,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
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
  sessionKey: PublicKey,
  duration?: bigint,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
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
): Promise<TransactionInstruction[]> {
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
  subAccountRoleId?: number,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
  const context = await getToggleSubAccountInstructionContext(
    swig,
    roleId,
    enabled,
    subAccountRoleId ?? roleId,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getWithdrawFromSubAccountInstructions(
  swig: Swig,
  roleId: number,
  withdrawArgs: WithdrawSubAccountArgs<PublicKey>,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
  const context = await getWithdrawFromSubAccountInstructionContext(
    swig,
    roleId,
    withdrawArgs,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getWithdrawFromSubAccountCheckedInstructions<
  T extends PublicKey = PublicKey,
>(
  swig: Swig,
  roleId: number,
  withdrawArgs: WithdrawSubAccountCheckedArgs<T>,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
  const context = await getWithdrawFromSubAccountCheckedInstructionContext(
    swig,
    roleId,
    withdrawArgs,
    options,
  );

  return getInstructionsFromContext(context);
}

export async function getTransferAssetsInstructions(
  swig: Swig,
  roleId: number,
  options?: SwigOptions,
): Promise<TransactionInstruction[]> {
  const context = await getTransferAssetsInstructionContext(
    swig,
    roleId,
    options,
  );

  return getInstructionsFromContext(context);
}

export function getTransactionInstructionFromWeb3Instruction(
  ix: Web3Instruction,
): TransactionInstruction {
  return {
    programId: new PublicKey(ix.programId.toBytes()),
    keys: ix.keys.map((meta) => ({
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
      pubkey: new PublicKey(meta.pubkey.toBytes()),
    })),
    data: Buffer.from(ix.data),
  };
}

export function getInstructionsFromContext(
  swigContext: SwigInstructionContext,
): TransactionInstruction[] {
  return swigContext
    .getWeb3Instructions()
    .map(getTransactionInstructionFromWeb3Instruction);
}

export class AddMultipleAuthoritiesInstructionBuilder {
  #builder: AddMultipleAuthoritiesInstructionContextBuilder;

  constructor(builder: AddMultipleAuthoritiesInstructionContextBuilder) {
    this.#builder = builder;
  }

  static async create(swig: Swig, roleId: number, options?: SwigOptions) {
    const ixBuilder = await getAddMultipleAuthoritiesInstructionsContextBuilder(
      swig,
      roleId,
      options,
    );

    return new AddMultipleAuthoritiesInstructionBuilder(ixBuilder);
  }

  static withCreateSwigInstruction(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
    id: Uint8Array;
    actions: Actions;
    authorityInfo: CreateAuthorityInfo;
    options: {
      signingFn?: SigningFn;
      currentSlot?: bigint;
    };
  }) {
    const ixBuilder =
      getCreateSwigWithMultipleAuthoritiesInstructionContextBuilder(args);
    return new AddMultipleAuthoritiesInstructionBuilder(ixBuilder);
  }

  addAuthority = (newAuthorityInfo: CreateAuthorityInfo, actions: Actions) => {
    this.#builder.addAuthority(newAuthorityInfo, actions);
    return this;
  };

  getInstructions = async (): Promise<TransactionInstruction[]> => {
    const ixContexts = await this.#builder.getInstructionContexts();
    return ixContexts.flatMap(getInstructionsFromContext);
  };
}

export async function getAddMultipleAuthoritiesInstructionBuilder(
  swig: Swig,
  roleId: number,
  options?: SwigOptions,
) {
  return AddMultipleAuthoritiesInstructionBuilder.create(swig, roleId, options);
}

export function getCreateSwigInstructionBuilder(args: {
  payer: PublicKey;
  swigAddress: PublicKey;
  id: Uint8Array;
  actions: Actions;
  authorityInfo: CreateAuthorityInfo;
  options: {
    signingFn?: SigningFn;
    currentSlot?: bigint;
  };
}) {
  return AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction(
    args,
  );
}
