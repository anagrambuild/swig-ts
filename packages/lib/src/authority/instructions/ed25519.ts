import {
  SwigInstructionV1,
  SwigInstructionV2,
  compactInstructions,
  getAddV1BaseAccountMetasWithAuthority,
  getCloseSwigV1BaseAccountMetasWithAuthority,
  getCloseTokenAccountV1BaseAccountMetasWithAuthority,
  getCreateSessionV1BaseAccountMetasWithAuthority,
  getRemoveV1BaseAccountMetasWithAuthority,
  getSignV1BaseAccountMetasWithAuthority,
  getSignV2BaseAccountMetasWithAuthority,
  getSubAccountCreateV1BaseAccountMetasWithAuthority,
  getSubAccountSignV1BaseAccountMetasWithAuthority,
  getSubAccountToggleV1BaseAccountMetasWithAuthority,
  getSubAccountWithdrawV1AccountMetasWithAuthorityContext,
  getSubAccountWithdrawV1SolAccountMetas,
  getSubAccountWithdrawV1TokenAccountMetas,
  getTransferAssetsV1BaseAccountMetasWithAuthority,
  getUpdateAuthorityV1BaseAccountMetasWithAuthority,
} from '../../instructions';
import { SolAccountMeta, SolPublicKey } from '../../solana';
import type { AuthorityInstruction } from './interface';

/**
 * Ed25519 Authority Instructions
 */
export const Ed25519Instruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [addAuthorityIxAccountMetas, authorityPayload] =
      getAddV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.addAuthority(addAuthorityIxAccountMetas, {
      ...data,
      authorityPayload: new Uint8Array([authorityPayload]),
    });
  },

  async removeAuthorityV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [removeIxAccountMetas, authorityPayload] =
      getRemoveV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.removeAuthority(removeIxAccountMetas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async updateAuthorityV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [metas, authorityPayload] =
      getUpdateAuthorityV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.updateAuthority(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async signV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

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

  async signV2Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [signInstructionsAccount, authorityPayload] =
      getSignV2BaseAccountMetasWithAuthority(accounts, authority);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
      [accounts.swigSystemAddress],
    );

    return SwigInstructionV2.sign(metas, {
      roleId: data.roleId,
      authorityPayload: new Uint8Array([authorityPayload]),
      compactInstructions: compactIxs,
    });
  },

  async createSessionV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [createSessionAccount, authorityPayload] =
      getCreateSessionV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.createSession(createSessionAccount, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountCreateV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [metas, authorityPayload] =
      getSubAccountCreateV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.subAccountCreate(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountWithdrawV1SolInstruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const baseMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);
    const authorityMeta = SolAccountMeta.from({
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    });

    const [metas, authorityIndex] =
      getSubAccountWithdrawV1AccountMetasWithAuthorityContext(
        baseMetas,
        authorityMeta,
      );

    return SwigInstructionV1.subAccountWithdraw(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityIndex]),
    });
  },

  async subAccountWithdrawV1TokenInstruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const baseMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
    const authorityMeta = SolAccountMeta.from({
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    });

    const [metas, authorityIndex] =
      getSubAccountWithdrawV1AccountMetasWithAuthorityContext(
        baseMetas,
        authorityMeta,
      );

    return SwigInstructionV1.subAccountWithdraw(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityIndex]),
    });
  },

  async subAccountToggleV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [metas, authorityPayload] =
      getSubAccountToggleV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.subAccountToggle(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async subAccountSignV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [signAccounts, authorityPayload] =
      getSubAccountSignV1BaseAccountMetasWithAuthority(accounts, authority);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signAccounts,
      data.innerInstructions,
      [accounts.subAccount],
    );

    return SwigInstructionV1.subAccountSign(metas, {
      roleId: data.roleId,
      authorityPayload: new Uint8Array([authorityPayload]),
      compactInstructions: compactIxs,
    });
  },

  async transferAssetsV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [metas, authorityPayload] =
      getTransferAssetsV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.transferAssets(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async closeSwigV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [metas, authorityPayload] =
      getCloseSwigV1BaseAccountMetasWithAuthority(accounts, authority);

    return SwigInstructionV1.closeSwig(metas, {
      ...data,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },

  async closeTokenAccountV1Instruction(accounts, data) {
    const authority = new SolPublicKey(new Uint8Array(data.authorityData));

    const [baseMetas, authorityPayload] =
      getCloseTokenAccountV1BaseAccountMetasWithAuthority(accounts, authority);

    // Append writable token account metas after the authority
    const tokenAccountMetas = (data.tokenAccounts ?? []).map((ta: any) =>
      SolAccountMeta.from({
        pubkey: new SolPublicKey(ta),
        isSigner: false,
        isWritable: true,
      }),
    );

    const allMetas = [...baseMetas, ...tokenAccountMetas] as [
      ...typeof baseMetas,
      ...SolAccountMeta[],
    ];

    return SwigInstructionV1.closeTokenAccount(allMetas, {
      ...data,
      // token_account_offset = index of first token account in accounts array
      tokenAccountOffset: baseMetas.length,
      authorityPayload: Uint8Array.from([authorityPayload]),
    });
  },
};
