import { PublicKey } from '@solana/web3.js';
import {
  SwigInstructionV1,
  compactInstructions,
  getAddV1BaseAccountMetasWithAuthority,
  getRemoveV1BaseAccountMetasWithAuthority,
  getSignV1BaseAccountMetasWithAuthority,
  getSubAccountCreateV1BaseAccountMetasWithAuthority,
  getSubAccountSignV1BaseAccountMetasWithAuthority,
  getSubAccountToggleV1BaseAccountMetasWithAuthority,
  getSubAccountWithdrawV1SolAccountMetasWithAuthority,
  getSubAccountWithdrawV1TokenAccountMetasWithAuthority,
} from '../../instructions';
import { getCreateSessionV1BaseAccountMetasWithAuthority } from '../../instructions/createSessionV1';
import type { AuthorityInstruction } from './interface';

/**
 * Ed25519 Authority Instructions
 */
export const Ed25519Instruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [addAuthorityIxAccountMetas, authorityPayload] =
      getAddV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.addAuthority(addAuthorityIxAccountMetas, {
      ...data,
      authorityPayload: new Uint8Array([authorityPayload]),
    });
  },

  async removeAuthorityV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [removeIxAccountMetas, authorityPayload] =
      getRemoveV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.removeAuthority(removeIxAccountMetas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async signV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [signInstructionsAccount, authorityPayload] =
      getSignV1BaseAccountMetasWithAuthority(accounts, authority);

    const { accounts: metas, compactIxs } = compactInstructions(
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

  async createSessionV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [createSessionAccount, authorityPayload] =
      getCreateSessionV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.createSession(createSessionAccount, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountCreateV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [metas, authorityPayload] =
      getSubAccountCreateV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.subAccountCreate(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountWithdrawV1SolInstruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [metas, authorityPayload] =
      getSubAccountWithdrawV1SolAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.subAccountWithdraw(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountWithdrawV1TokenInstruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [metas, authorityPayload] =
      getSubAccountWithdrawV1TokenAccountMetasWithAuthority(
        accounts,
        authority,
      );

    return SwigInstructionV1.subAccountWithdraw(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountToggleV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [metas, authorityPayload] =
      getSubAccountToggleV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.subAccountToggle(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountSignV1Instruction(accounts, data) {
    const authority = new PublicKey(data.authorityData);

    const [signAccounts, authorityPayload] =
      getSubAccountSignV1BaseAccountMetasWithAuthority(accounts, authority);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signAccounts,
      data.innerInstructions,
      accounts.subAccount,
    );

    return SwigInstructionV1.subAccountSign(metas, {
      roleId: data.roleId,
      authorityPayload: new Uint8Array([authorityPayload]),
      compactInstructions: compactIxs,
    });
  },
};
