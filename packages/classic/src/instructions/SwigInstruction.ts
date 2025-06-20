import type {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  getAddAuthorityV1InstructionCodec,
  getCreateSessionV1InstructionCodec,
  getCreateV1InstructionDataCodec,
  getRemoveAuthorityV1InstructionCodec,
  getSignV1InstructionCodec,
  getSubAccountCreateV1InstructionDataCodec,
  getSubAccountSignV1InstructionDataCodec,
  getSubAccountToggleV1InstructionDataCodec,
  getSubAccountWithdrawV1InstructionDataCodec,
  type AddAuthorityV1InstructionDataArgs,
  type CreateSessionV1InstructionDataArgs,
  type CreateV1InstructionDataArgs,
  type RemoveAuthorityV1InstructionDataArgs,
  type SignV1InstructionDataArgs,
  type SubAccountCreateV1InstructionDataArgs,
  type SubAccountSignV1InstructionDataArgs,
  type SubAccountToggleV1InstructionDataArgs,
  type SubAccountWithdrawV1InstructionDataArgs,
} from '@swig-wallet/coder';
import { findSwigPda, swigInstruction } from '../utils';
import { type AddAuthorityV1BaseAccountMetas } from './addAuthorityV1';
import type { CreateSessionV1BaseAccountMetas } from './createSessionV1';
import {
  getCreateV1BaseAccountMetas,
  type CreateV1BaseAccountMetas,
} from './createV1';
import { type RemoveAuthorityV1BaseAccountMetas } from './removeAuthorityV1';
import { type SignV1BaseAccountMetas } from './signV1';
import type { SubAccountCreateV1BaseAccountMetas } from './subAccountCreateV1';
import type { SubAccountSignV1BaseAccountMetas } from './subAccountSignV1';
import type { SubAccountToggleV1BaseAccountMetas } from './subAccountToggleV1';
import type { SubAccountWithdrawV1BaseAccountMetas } from './subAccountWithdrawV1';

/**
 *
 * @param accounts `CreateV1InstructionAccounts`
 * @param data `CreateV1InstructionDataArgs`
 * @returns `SwigInstruction`
 */
export function createSwigInstruction(
  accounts: { payer: PublicKey },
  data: Omit<CreateV1InstructionDataArgs, 'bump'>,
): TransactionInstruction {
  const [swigAddress, bump] = findSwigPda(Uint8Array.from(data.id));
  const createIxAccountMetas = getCreateV1BaseAccountMetas({
    ...accounts,
    swig: swigAddress,
  });
  return SwigInstructionV1.create(createIxAccountMetas, { ...data, bump });
}

/**
 * Ed25519 Authority
 */
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
  ): TransactionInstruction {
    const createV1InstructionDataEncoder =
      getCreateV1InstructionDataCodec().encoder;

    const createV1InstructionData = createV1InstructionDataEncoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(createV1InstructionData));
  }

  /**
   * Creates a `AddAuthorityV1` instruction
   * @param accounts AddAuthorityV1InstructionAccountsWithAuthority
   * @param data AddAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   */
  static addAuthority<
    T extends [...AddAuthorityV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: AddAuthorityV1InstructionDataArgs,
  ): TransactionInstruction {
    const addV1InstructionDataEncoder = getAddAuthorityV1InstructionCodec(
      data.authorityPayload.length,
      data.newAuthorityData.length,
    );

    const addAuthorityV1InstructionData =
      addV1InstructionDataEncoder.encode(data);

    return swigInstruction(
      accounts,
      new Uint8Array(addAuthorityV1InstructionData),
    );
  }

  /**
   * Creates a `RemoveAuthorityV1` instruction
   * @param accounts removeAuthorityV1InstructionAccountsWithAuthority
   * @param data removeAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   */
  static removeAuthority<
    T extends [...RemoveAuthorityV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: RemoveAuthorityV1InstructionDataArgs,
  ): TransactionInstruction {
    const removeV1InstructionDataEncoder = getRemoveAuthorityV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    const removeAuthorityV1InstructionData =
      removeV1InstructionDataEncoder.encode(data);

    return swigInstruction(
      accounts,
      new Uint8Array(removeAuthorityV1InstructionData),
    );
  }

  /**
   *
   * @param accounts SignAuthorityV1InstructionAccountsWithAuthority
   * @param data SignAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `SignV1` instruction
   */
  static sign<T extends [...SignV1BaseAccountMetas, ...AccountMeta[]]>(
    accounts: T,
    data: SignV1InstructionDataArgs,
  ): TransactionInstruction {
    const signV1InstructionDataEncoder = getSignV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    const signV1InstructionData = signV1InstructionDataEncoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(signV1InstructionData));
  }

  static createSession<
    T extends [...CreateSessionV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: CreateSessionV1InstructionDataArgs,
  ): TransactionInstruction {
    const createSessionV1InstructionDataEncoder =
      getCreateSessionV1InstructionCodec().encoder;

    const createSessionV1InstructionData =
      createSessionV1InstructionDataEncoder.encode(data);

    return swigInstruction(
      accounts,
      new Uint8Array(createSessionV1InstructionData),
    );
  }

  static subAccountCreate<
    T extends [...SubAccountCreateV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: SubAccountCreateV1InstructionDataArgs,
  ): TransactionInstruction {
    const subAccountCreateV1InstructionDataEncoder =
      getSubAccountCreateV1InstructionDataCodec().encoder;

    const subAccountCreateV1InstructionData =
      subAccountCreateV1InstructionDataEncoder.encode(data);

    return swigInstruction(
      accounts,
      new Uint8Array(subAccountCreateV1InstructionData),
    );
  }

  static subAccountSign<
    T extends [...SubAccountSignV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: SubAccountSignV1InstructionDataArgs,
  ): TransactionInstruction {
    const encoder = getSubAccountSignV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(instructionData));
  }

  static subAccountWithdraw<
    T extends [...SubAccountWithdrawV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: SubAccountWithdrawV1InstructionDataArgs,
  ): TransactionInstruction {
    const encoder = getSubAccountWithdrawV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(instructionData));
  }

  static subAccountToggle<
    T extends [...SubAccountToggleV1BaseAccountMetas, ...AccountMeta[]],
  >(
    accounts: T,
    data: SubAccountToggleV1InstructionDataArgs,
  ): TransactionInstruction {
    const encoder = getSubAccountToggleV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(instructionData));
  }
}
