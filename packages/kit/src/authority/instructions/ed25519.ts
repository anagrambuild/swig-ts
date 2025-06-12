import { getAddressCodec, type ReadonlyUint8Array } from '@solana/kit';
import {
  type AddAuthorityV1InstructionDataArgs,
  type RemoveAuthorityV1InstructionDataArgs,
  type ReplaceAuthorityV1InstructionDataArgs,
} from '@swig/coder';
import {
  SwigInstructionV1,
  compactInstructions,
  getAddV1BaseAccountMetasWithAuthority,
  getRemoveV1BaseAccountMetasWithAuthority,
  getReplaceV1BaseAccountMetasWithAuthority,
  getSignV1BaseAccountMetasWithAuthority,
  type AddAuthorityV1InstructionAccounts,
  type RemoveAuthorityV1InstructionAccounts,
  type ReplaceAuthorityV1InstructionAccounts,
  type SignV1InstructionAccounts,
} from '../../instructions';
import { type GenericInstruction, type SwigInstruction } from '../../utils';
import type { AuthorityInstruction } from '../interface';

/**
 * Ed25519 Authority
 */
export const Ed25519Instruction: AuthorityInstruction = {
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
    data: Omit<AddAuthorityV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
  ): SwigInstruction {
    let authority = getAddressCodec().decode(data.authorityData);

    let [addAuthorityIxAccountMetas, authorityPayload] =
      getAddV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.addAuthority(addAuthorityIxAccountMetas, {
      ...data,
      authorityPayload: new Uint8Array([authorityPayload]),
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
    data: Omit<RemoveAuthorityV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
  ): SwigInstruction {
    let authority = getAddressCodec().decode(data.authorityData);

    let [removeIxAccountMetas, authorityPayload] =
      getRemoveV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.removeAuthority(removeIxAccountMetas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
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
    data: Omit<ReplaceAuthorityV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
  ): SwigInstruction {
    let authority = getAddressCodec().decode(data.authorityData);

    let [replaceIxAccountMetas, authorityPayload] =
      getReplaceV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.replaceAuthority(replaceIxAccountMetas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
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
    let authority = getAddressCodec().decode(data.authorityData);

    let [signInstructionsAccount, authorityPayload] =
      getSignV1BaseAccountMetasWithAuthority(accounts, authority);

    let { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
    );

    return SwigInstructionV1.sign(metas, {
      roleId: data.roleId,
      authorityPayload: new Uint8Array([authorityPayload]),
      compactInstructions: compactIxs,
    });
  },
};
