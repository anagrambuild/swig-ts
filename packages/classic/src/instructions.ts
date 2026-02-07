import { PublicKey, type TransactionInstruction } from '@solana/web3.js';
import {
  Actions,
  AddMultipleAuthoritiesInstructionContextBuilder,
  getAddAuthorityInstructionContext,
  getAddMultipleAuthoritiesInstructionsContextBuilder,
  getCloseSwigInstructionContext,
  getCloseSwigTokenAccountInstructionContext,
  getCreateSessionInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getCreateSwigWithMultipleAuthoritiesInstructionContextBuilder,
  getRemoveAuthorityInstructionContext,
  getSignInstructionContext,
  getToggleSubAccountInstructionContext,
  getTransferAssetsInstructionContext,
  getUpdateAuthorityInstructionContext,
  getWithdrawFromSubAccountCheckedInstructionContext,
  getWithdrawFromSubAccountInstructionContext,
  SolInstruction,
  Swig,
  SwigInstructionContext,
  type CloseSwigArgs,
  type CloseSwigTokenAccountArgs,
  type CreateAuthorityInfo,
  type SigningFn,
  type SwigOptions,
  type UpdateAuthorityActionsInfo,
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
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getAddAuthorityInstructionContext(
    swig,
    roleId,
    newAuthorityInfo,
    actions,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getRemoveAuthorityInstructions(
  swig: Swig,
  roleId: number,
  roleToRemoveId: number,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getRemoveAuthorityInstructionContext(
    swig,
    roleId,
    roleToRemoveId,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getUpdateAuthorityInstructions(
  swig: Swig,
  roleId: number,
  roleToUpdateId: number,
  updateActionsInfo: UpdateAuthorityActionsInfo,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getUpdateAuthorityInstructionContext(
    swig,
    roleId,
    roleToUpdateId,
    updateActionsInfo,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getSignInstructions(
  swig: Swig,
  roleId: number,
  instructions: TransactionInstruction[],
  withSubAccount?: boolean,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getSignInstructionContext(
    swig,
    roleId,
    instructions.map(SolInstruction.from),
    withSubAccount,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getCreateSessionInstructions(
  swig: Swig,
  roleId: number,
  sessionKey: PublicKey,
  duration?: bigint,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getCreateSessionInstructionContext(
    swig,
    roleId,
    sessionKey,
    duration,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getCreateSubAccountInstructions(
  swig: Swig,
  roleId: number,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getCreateSubAccountInstructionContext(
    swig,
    roleId,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getToggleSubAccountInstructions(
  swig: Swig,
  roleId: number,
  enabled: boolean,
  subAccountRoleId?: number,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getToggleSubAccountInstructionContext(
    swig,
    roleId,
    enabled,
    subAccountRoleId ?? roleId,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getWithdrawFromSubAccountInstructions(
  swig: Swig,
  roleId: number,
  withdrawArgs: WithdrawSubAccountArgs<PublicKey>,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getWithdrawFromSubAccountInstructionContext(
    swig,
    roleId,
    withdrawArgs,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getWithdrawFromSubAccountCheckedInstructions<
  T extends PublicKey = PublicKey,
>(
  swig: Swig,
  roleId: number,
  withdrawArgs: WithdrawSubAccountCheckedArgs<T>,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getWithdrawFromSubAccountCheckedInstructionContext(
    swig,
    roleId,
    withdrawArgs,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getTransferAssetsInstructions(
  swig: Swig,
  roleId: number,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getTransferAssetsInstructionContext(
    swig,
    roleId,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getCloseSwigInstructions(
  swig: Swig,
  roleId: number,
  args: CloseSwigArgs<PublicKey>,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getCloseSwigInstructionContext(
    swig,
    roleId,
    args,
    toLibOptions(options),
  );

  return getInstructionsFromContext(context);
}

export async function getCloseSwigTokenAccountInstructions(
  swig: Swig,
  roleId: number,
  args: CloseSwigTokenAccountArgs<PublicKey>,
  options?: SwigInstructionOptions,
): Promise<TransactionInstruction[]> {
  const context = await getCloseSwigTokenAccountInstructionContext(
    swig,
    roleId,
    args,
    toLibOptions(options),
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

  static async create(
    swig: Swig,
    roleId: number,
    options?: SwigInstructionOptions,
  ) {
    const ixBuilder = await getAddMultipleAuthoritiesInstructionsContextBuilder(
      swig,
      roleId,
      toLibOptions(options),
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
  options?: SwigInstructionOptions,
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

function toLibOptions(
  options?: SwigInstructionOptions,
): SwigOptions | undefined {
  if (!options) return undefined;
  return {
    ...options,
    preInstructions: options.preInstructions?.map(SolInstruction.from),
    postInstructions: options.postInstructions?.map(SolInstruction.from),
  };
}

export type SwigInstructionOptions = Omit<
  SwigOptions,
  'preInstructions' | 'postInstructions'
> & {
  preInstructions?: TransactionInstruction[];
  postInstructions?: TransactionInstruction[];
};
