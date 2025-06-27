import type { AccountRole, Address, IInstruction } from '@solana/kit';
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
export async function createSwigInstruction(
  accounts: { payer: Address },
  data: Omit<CreateV1InstructionDataArgs, 'bump'>,
): Promise<IInstruction> {
  const [swigAddress, bump] = await findSwigPda(Uint8Array.from(data.id));
  [swigAddress, accounts.payer].forEach((address) => {
    if (
      !address ||
      address === 'undefined' ||
      (typeof address === 'string' && address.length < 32)
    ) {
      throw new Error(
        `[kit][guard] Invalid address in createSwigInstruction: ${address}`,
      );
    }
  });
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
  ): IInstruction {
    accounts.forEach((meta) => {
      if (
        !meta.address ||
        meta.address === 'undefined' ||
        (typeof meta.address === 'string' && meta.address.length < 32)
      ) {
        throw new Error(
          `[kit][guard] Invalid meta address in SwigInstructionV1.create: ${meta.address}`,
        );
      }
    });
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
    T extends [
      ...AddAuthorityV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: AddAuthorityV1InstructionDataArgs): IInstruction {
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
    T extends [
      ...RemoveAuthorityV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: RemoveAuthorityV1InstructionDataArgs): IInstruction {
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
  static sign<
    T extends [
      ...SignV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: SignV1InstructionDataArgs): IInstruction {
    // Deep clone and guard
    const cloned = accounts.map((x) => ({ ...x })) as T;
    cloned.forEach((meta, i) => {
      if (
        !meta.address ||
        meta.address === 'undefined' ||
        (typeof meta.address === 'string' && meta.address.length < 32)
      ) {
        console.error(
          '[kit][FATAL] SwigInstructionV1.sign: meta.address is undefined:',
          meta,
          'at index',
          i,
          'stack:',
          new Error().stack,
        );
        throw new Error(
          '[kit][FATAL] SwigInstructionV1.sign: meta.address is undefined: ' +
            JSON.stringify(meta) +
            ' at index ' +
            i +
            ' stack: ' +
            new Error().stack,
        );
      }
    });
    const signV1InstructionDataEncoder = getSignV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;
    const signV1InstructionData = signV1InstructionDataEncoder.encode(data);
    // Temporary workaround: filter out invalid metas
    const filtered = cloned.filter(
      (meta) =>
        meta.address &&
        meta.address !== 'undefined' &&
        (typeof meta.address !== 'string' || meta.address.length >= 32),
    );
    if (filtered.length !== cloned.length) {
      console.warn(
        '[kit][WARN] SwigInstructionV1.sign: filtered out invalid metas:',
        cloned.filter(
          (meta) =>
            !meta.address ||
            meta.address === 'undefined' ||
            (typeof meta.address === 'string' && meta.address.length < 32),
        ),
      );
    }
    console.log(
      '[kit][FINAL] SwigInstructionV1.sign: passing metas to SDK:',
      JSON.stringify(filtered),
    );
    return swigInstruction(
      filtered as T,
      new Uint8Array(signV1InstructionData),
    );
  }

  static createSession<
    T extends [
      ...CreateSessionV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: CreateSessionV1InstructionDataArgs): IInstruction {
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
    T extends [
      ...SubAccountCreateV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: SubAccountCreateV1InstructionDataArgs): IInstruction {
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
    T extends [
      ...SubAccountSignV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: SubAccountSignV1InstructionDataArgs): IInstruction {
    // Deep clone and guard
    const cloned = accounts.map((x) => ({ ...x })) as T;
    cloned.forEach((meta, i) => {
      if (
        !meta.address ||
        meta.address === 'undefined' ||
        (typeof meta.address === 'string' && meta.address.length < 32)
      ) {
        console.error(
          '[kit][FATAL] SwigInstructionV1.subAccountSign: meta.address is undefined:',
          meta,
          'at index',
          i,
          'stack:',
          new Error().stack,
        );
        throw new Error(
          '[kit][FATAL] SwigInstructionV1.subAccountSign: meta.address is undefined: ' +
            JSON.stringify(meta) +
            ' at index ' +
            i +
            ' stack: ' +
            new Error().stack,
        );
      }
    });
    const encoder = getSubAccountSignV1InstructionDataCodec().encoder;
    const instructionData = encoder.encode(data);
    // Temporary workaround: filter out invalid metas
    const filtered2 = cloned.filter(
      (meta) =>
        meta.address &&
        meta.address !== 'undefined' &&
        (typeof meta.address !== 'string' || meta.address.length >= 32),
    );
    if (filtered2.length !== cloned.length) {
      console.warn(
        '[kit][WARN] SwigInstructionV1.subAccountSign: filtered out invalid metas:',
        cloned.filter(
          (meta) =>
            !meta.address ||
            meta.address === 'undefined' ||
            (typeof meta.address === 'string' && meta.address.length < 32),
        ),
      );
    }
    console.log(
      '[kit][FINAL] SwigInstructionV1.subAccountSign: passing metas to SDK:',
      JSON.stringify(filtered2),
    );
    return swigInstruction(filtered2 as T, new Uint8Array(instructionData));
  }

  static subAccountWithdraw<
    T extends [
      ...SubAccountWithdrawV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: SubAccountWithdrawV1InstructionDataArgs): IInstruction {
    const encoder = getSubAccountWithdrawV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(instructionData));
  }

  static subAccountToggle<
    T extends [
      ...SubAccountToggleV1BaseAccountMetas,
      ...{ address: Address; role: AccountRole }[],
    ],
  >(accounts: T, data: SubAccountToggleV1InstructionDataArgs): IInstruction {
    const encoder = getSubAccountToggleV1InstructionDataCodec().encoder;

    const instructionData = encoder.encode(data);

    return swigInstruction(accounts, new Uint8Array(instructionData));
  }
}
