import {
  getArrayEncoder,
  getU8Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getActionEncoder,
  getCompactInstructionEncoder,
  type AddAuthorityV1InstructionDataArgs,
  type RemoveAuthorityV1InstructionDataArgs,
  type ReplaceAuthorityV1InstructionDataArgs,
} from '@swig/coder';
import {
  SwigInstructionV1,
  compactInstructions,
  getAddAuthorityV1BaseAccountMetas,
  getRemoveAuthorityV1BaseAccountMetas,
  getReplaceAuthorityV1BaseAccountMetas,
  getSignV1BaseAccountMetas,
  type AddAuthorityV1InstructionAccounts,
  type RemoveAuthorityV1InstructionAccounts,
  type ReplaceAuthorityV1InstructionAccounts,
  type SignV1InstructionAccounts,
} from '../../instructions';
import { type GenericInstruction, type SwigInstruction } from '../../utils';
import type { AuthorityInstruction } from '../interface';

/**
 * Secp256k1 Authority
 */
export const Secp256k1Instruction: AuthorityInstruction = {
  /**
   *
   * @param accounts AddAuthorityV1InstructionAccountsWithAuthority
   * @param data AddAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `AddAuthorityV1` instruction
   */
  addAuthorityV1Instruction(
    accounts: AddAuthorityV1InstructionAccounts,
    data: Omit<AddAuthorityV1InstructionDataArgs, 'authorityPayload'>,
  ): SwigInstruction {
    let addAuthorityIxAccountMetas =
      getAddAuthorityV1BaseAccountMetas(accounts);

    let authorityPayload = secp256k1Payload(
      getArrayEncoder(getActionEncoder()).encode(data.actions),
    );

    return SwigInstructionV1.addAuthority(addAuthorityIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  /**
   *
   * @param accounts removeAuthorityV1InstructionAccountsWithAuthority
   * @param data removeAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `RemoveAuthorityV1` instruction
   */
  removeAuthorityV1Instruction(
    accounts: RemoveAuthorityV1InstructionAccounts,
    data: Omit<RemoveAuthorityV1InstructionDataArgs, 'authorityPayload'>,
  ): SwigInstruction {
    let removeIxAccountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);

    let authorityPayload = secp256k1Payload(Uint8Array.from([]));

    return SwigInstructionV1.removeAuthority(removeIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  /**
   *
   * @param accounts ReplaceAuthorityV1InstructionAccountsWithAuthority
   * @param data replaceAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `ReplaceAuthorityV1` instruction
   */
  replaceAuthorityV1Instruction(
    accounts: ReplaceAuthorityV1InstructionAccounts,
    data: Omit<ReplaceAuthorityV1InstructionDataArgs, 'authorityPayload'>,
  ): SwigInstruction {
    let replaceIxAccountMetas = getReplaceAuthorityV1BaseAccountMetas(accounts);

    let authorityPayload = secp256k1Payload(
      getArrayEncoder(getActionEncoder()).encode(data.actions),
    );

    return SwigInstructionV1.replaceAuthority(replaceIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  /**
   *
   * @param accounts SignAuthorityV1InstructionAccountsWithAuthority
   * @param data SignAuthorityV1InstructionDataArgs
   * @returns SwigInstruction
   *
   * Creates a `SignV1` instruction
   */
  signV1Instruction(
    accounts: SignV1InstructionAccounts,
    data: {
      authorityData: ReadonlyUint8Array;
      roleId: number;
      innerInstructions: GenericInstruction[];
    },
  ): SwigInstruction {
    let signInstructionsAccount = getSignV1BaseAccountMetas(accounts);

    let { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
    );

    let authorityPayload = secp256k1Payload(
      getArrayEncoder(getCompactInstructionEncoder(), {
        size: getU8Encoder(),
      }).encode(compactIxs),
    );

    return SwigInstructionV1.sign(metas, {
      roleId: data.roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },
};

/**
 * Derive the payload for a Secp256k1 authority
 */
export function secp256k1Payload(data: ReadonlyUint8Array): ReadonlyUint8Array {
  throw new Error('not implemented');
}
