import {
  getAddAuthorityV1InstructionCodec,
  getCreateSessionV1InstructionCodec,
  getCreateV1InstructionDataCodec,
  getRemoveAuthorityV1InstructionCodec,
  getSignV1InstructionCodec,
  getSignV2InstructionCodec,
  getSubAccountCreateV1InstructionDataCodec,
  getSubAccountSignV1InstructionDataCodec,
  getSubAccountToggleV1InstructionDataCodec,
  getSubAccountWithdrawV1InstructionDataCodec,
  getTransferAssetsV1InstructionDataCodec,
  getUpdateAuthorityV1InstructionCodec,
  type AddAuthorityV1InstructionDataArgs,
  type CreateSessionV1InstructionDataArgs,
  type CreateV1InstructionDataArgs,
  type RemoveAuthorityV1InstructionDataArgs,
  type SignV1InstructionDataArgs,
  type SignV2InstructionDataArgs,
  type SubAccountCreateV1InstructionDataArgs,
  type SubAccountSignV1InstructionDataArgs,
  type SubAccountToggleV1InstructionDataArgs,
  type SubAccountWithdrawV1InstructionDataArgs,
  type TransferAssetsV1InstructionDataArgs,
  type UpdateAuthorityV1InstructionDataArgs,
} from '@swig-wallet/coder';
import {
  SolAccountMeta,
  SolInstruction,
  swigInstruction as swigInst,
  SwigInstructionContext,
  type SolPublicKeyData,
} from '../solana';
import { findSwigPdaRaw, findSwigSystemAddressPdaRaw } from '../utils';
import { type AddAuthorityV1BaseAccountMetas } from './addAuthorityV1';
import type { CreateSessionV1BaseAccountMetas } from './createSessionV1';
import {
  getCreateV1BaseAccountMetas,
  type CreateV1BaseAccountMetas,
} from './createV1';
import { type RemoveAuthorityV1BaseAccountMetas } from './removeAuthorityV1';
import { type SignV1BaseAccountMetas } from './signV1';
import type { SignV2BaseAccountMetas } from './signV2';
import type { SubAccountCreateV1BaseAccountMetas } from './subAccountCreateV1';
import type { SubAccountSignV1BaseAccountMetas } from './subAccountSignV1';
import type { SubAccountToggleV1BaseAccountMetas } from './subAccountToggleV1';
import type { SubAccountWithdrawV1BaseAccountMetas } from './subAccountWithdrawV1';
import type { TransferAssetsV1BaseAccountMetas } from './transferAssetsV1';
import type { UpdateAuthorityV1BaseAccountMetas } from './updateAuthorityV1';

/**
 *
 * @param accounts `CreateV1InstructionAccounts`
 * @param data `CreateV1InstructionDataArgs`
 * @returns `SwigInstruction`
 */
export async function createV1SwigInstruction(
  accounts: { payer: SolPublicKeyData },
  data: Omit<CreateV1InstructionDataArgs, 'bump' | 'walletBump'>,
): Promise<SwigInstructionContext> {
  const [swigAddress, bump] = await findSwigPdaRaw(Uint8Array.from(data.id));
  const [swigSystemAddress, walletBump] =
    await findSwigSystemAddressPdaRaw(swigAddress);
  const createIxAccountMetas = getCreateV1BaseAccountMetas({
    ...accounts,
    swig: swigAddress,
    swigSystemAddress,
  });
  return SwigInstructionV1.create(createIxAccountMetas, {
    ...data,
    bump,
    walletBump,
  });
}

export class SwigInstructionV1 {
  /**
   *
   * @param accounts CreateV1InstructionAccounts
   * @param data CreateV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `CreateV1` instruction
   */
  static create<T extends CreateV1BaseAccountMetas = CreateV1BaseAccountMetas>(
    accounts: T,
    data: CreateV1InstructionDataArgs,
  ): SwigInstructionContext {
    const createV1InstructionDataEncoder =
      getCreateV1InstructionDataCodec().encoder;

    const createV1InstructionData = createV1InstructionDataEncoder.encode(data);

    const swigInstruction = swigInst(
      accounts,
      new Uint8Array(createV1InstructionData),
    );

    return new SwigInstructionContext({ swigInstruction });
  }

  /**
   * Creates a `AddAuthorityV1` instruction
   * @param accounts AddAuthorityV1InstructionAccountsWithAuthority
   * @param data AddAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   */
  static addAuthority<
    T extends [...AddAuthorityV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: AddAuthorityV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const addV1InstructionDataEncoder = getAddAuthorityV1InstructionCodec(
      data.authorityPayload.length,
      data.newAuthorityData.length,
    );

    const instructionData = addV1InstructionDataEncoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  /**
   * Creates a `RemoveAuthorityV1` instruction
   * @param accounts removeAuthorityV1InstructionAccountsWithAuthority
   * @param data removeAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   */
  static removeAuthority<
    T extends [...RemoveAuthorityV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: RemoveAuthorityV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const removeV1InstructionDataEncoder = getRemoveAuthorityV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    const instructionData = removeV1InstructionDataEncoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static updateAuthority<
    T extends [...UpdateAuthorityV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: UpdateAuthorityV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const encoder = getUpdateAuthorityV1InstructionCodec().encoder;

    const instructionData = encoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  /**
   *
   * @param accounts SignAuthorityV1InstructionAccountsWithAuthority
   * @param data SignAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `SignV1` instruction
   */
  static sign<T extends [...SignV1BaseAccountMetas, ...SolAccountMeta[]]>(
    accounts: T,
    data: SignV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const signV1InstructionDataEncoder = getSignV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    const instructionData = signV1InstructionDataEncoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static createSession<
    T extends [...CreateSessionV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: CreateSessionV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const createSessionV1InstructionDataEncoder =
      getCreateSessionV1InstructionCodec().encoder;

    const instructionData = createSessionV1InstructionDataEncoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static subAccountCreate<
    T extends [...SubAccountCreateV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: SubAccountCreateV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const subAccountCreateV1InstructionDataEncoder =
      getSubAccountCreateV1InstructionDataCodec().encoder;

    const instructionData =
      subAccountCreateV1InstructionDataEncoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static subAccountSign<
    T extends [...SubAccountSignV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: SubAccountSignV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const encoder = getSubAccountSignV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static subAccountWithdraw<
    T extends [...SubAccountWithdrawV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: SubAccountWithdrawV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const encoder = getSubAccountWithdrawV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static subAccountToggle<
    T extends [...SubAccountToggleV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: SubAccountToggleV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const encoder = getSubAccountToggleV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }

  static transferAssets<
    T extends [...TransferAssetsV1BaseAccountMetas, ...SolAccountMeta[]],
  >(
    accounts: T,
    data: TransferAssetsV1InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const encoder = getTransferAssetsV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }
}

export class SwigInstructionV2 {
  static sign<T extends [...SignV2BaseAccountMetas, ...SolAccountMeta[]]>(
    accounts: T,
    data: SignV2InstructionDataArgs,
    options?: SwigInstructionContextOptions,
  ): SwigInstructionContext {
    const encoder = getSignV2InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    const instructionData = encoder.encode(data);

    const swigInstruction = swigInst(accounts, new Uint8Array(instructionData));

    return new SwigInstructionContext({ swigInstruction, ...options });
  }
}

type SwigInstructionContextOptions = {
  preInstructions?: SolInstruction[];
  postInstructions?: SolInstruction[];
};
