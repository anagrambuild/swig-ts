import {
  containsBytes,
  getU8Encoder,
  type IAccountMeta,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getAddAuthorityV1InstructionCodec,
  getCreateV1InstructionDataCodec,
  getRemoveAuthorityV1InstructionCodec,
  getReplaceAuthorityV1InstructionCodec,
  getSignV1InstructionCodec,
  type AddAuthorityV1InstructionDataArgs,
  type CreateV1InstructionDataArgs,
  type RemoveAuthorityV1InstructionDataArgs,
  type ReplaceAuthorityV1InstructionDataArgs,
  type SignV1InstructionDataArgs,
} from '@swig/coder';
import { swigInstuction, type SwigInstruction } from '../utils';
import { type AddAuthorityV1BaseAccountMetas } from './addAuthorityV1';
import {
  getCreateV1BaseAccountMetas,
  type CreateV1BaseAccountMetas,
  type CreateV1InstructionAccounts,
} from './createV1';
import { type RemoveAuthorityV1BaseAccountMetas } from './removeAuthorityV1';
import { type ReplaceAuthorityV1BaseAccountMetas } from './replaceAuthorityV1';
import { type SignV1BaseAccountMetas } from './signV1';

/**
 *
 * @param accounts `CreateV1InstructionAccounts`
 * @param data `CreateV1InstructionDataArgs`
 * @returns `SwigInstruction`
 */
export function createSwigInstruction(
  accounts: CreateV1InstructionAccounts,
  data: CreateV1InstructionDataArgs,
): SwigInstruction {
  let createIxAccountMetas = getCreateV1BaseAccountMetas(accounts);
  return SwigInstructionV1.create(createIxAccountMetas, data);
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
  ): SwigInstruction {
    let createV1InstructionDataEncoder = getCreateV1InstructionDataCodec();

    let createV1InstructionData = createV1InstructionDataEncoder.encode(data);

    return swigInstuction(accounts, new Uint8Array(createV1InstructionData));
  }

  /**
   *
   * @param accounts AddAuthorityV1InstructionAccountsWithAuthority
   * @param data AddAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `AddAuthorityV1` instruction
   */
  static addAuthority<
    T extends [...AddAuthorityV1BaseAccountMetas, ...IAccountMeta[]],
  >(accounts: T, data: AddAuthorityV1InstructionDataArgs): SwigInstruction {
    let addV1InstructionDataEncoder = getAddAuthorityV1InstructionCodec(
      data.authorityPayload.length,
      data.newAuthorityData.length,
    ).encoder;

    let addAuthorityV1InstructionData =
      addV1InstructionDataEncoder.encode(data);

    return swigInstuction(
      accounts,
      new Uint8Array(addAuthorityV1InstructionData),
    );
  }

  /**
   *
   * @param accounts removeAuthorityV1InstructionAccountsWithAuthority
   * @param data removeAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `RemoveAuthorityV1` instruction
   */
  static removeAuthority<
    T extends [...RemoveAuthorityV1BaseAccountMetas, ...IAccountMeta[]],
  >(accounts: T, data: RemoveAuthorityV1InstructionDataArgs): SwigInstruction {
    let removeV1InstructionDataEncoder = getRemoveAuthorityV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    let removeAuthorityV1InstructionData =
      removeV1InstructionDataEncoder.encode(data);

    return swigInstuction(
      accounts,
      new Uint8Array(removeAuthorityV1InstructionData),
    );
  }

  /**
   *
   * @param accounts ReplaceAuthorityV1InstructionAccountsWithAuthority
   * @param data replaceAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `ReplaceAuthorityV1` instruction
   */
  static replaceAuthority<
    T extends [...ReplaceAuthorityV1BaseAccountMetas, ...IAccountMeta[]],
  >(accounts: T, data: ReplaceAuthorityV1InstructionDataArgs): SwigInstruction {
    let replaceV1InstructionDataEncoder = getReplaceAuthorityV1InstructionCodec(
      data.authorityPayload.length,
      data.newAuthorityData.length,
    ).encoder;

    let replaceAuthorityV1InstructionData =
      replaceV1InstructionDataEncoder.encode(data);

    return swigInstuction(
      accounts,
      new Uint8Array(replaceAuthorityV1InstructionData),
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
  static sign<T extends [...SignV1BaseAccountMetas, ...IAccountMeta[]]>(
    accounts: T,
    data: SignV1InstructionDataArgs,
  ): SwigInstruction {
    let signV1InstructionDataEncoder = getSignV1InstructionCodec(
      data.authorityPayload.length,
    ).encoder;

    let signV1InstructionData = signV1InstructionDataEncoder.encode(data);

    return swigInstuction(accounts, new Uint8Array(signV1InstructionData));
  }
}
