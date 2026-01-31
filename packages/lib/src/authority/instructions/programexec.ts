import { getProgramExecDecoder } from '@swig-wallet/coder';
import {
  SwigInstructionV1,
  SwigInstructionV2,
  compactInstructions,
  getAddAuthorityV1BaseAccountMetas,
  getCreateSessionV1BaseAccountMetas,
  getRemoveAuthorityV1BaseAccountMetas,
  getSignV1BaseAccountMetas,
  getSignV2BaseAccountMetas,
  getSubAccountCreateV1BaseAccountMetas,
  getSubAccountSignV1BaseAccountMetas,
  getSubAccountToggleV1BaseAccountMetas,
  getSubAccountWithdrawV1SolAccountMetas,
  getSubAccountWithdrawV1TokenAccountMetas,
  getTransferAssetsV1BaseAccountMetas,
  getUpdateAuthorityV1BaseAccountMetas,
} from '../../instructions';
import {
  SolAccountMeta,
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../../solana';
import type { AuthorityInstruction, InstructionDataOptions } from './interface';

/**
 * Instructions Sysvar address (SysvarInstructions111111111111111111111111111)
 */
const SYSVAR_INSTRUCTIONS_ADDRESS =
  'Sysvar1nstructions1111111111111111111111111';

/**
 * Creates the Instructions Sysvar account meta.
 */
function getInstructionsSysvarMeta(): SolAccountMeta {
  return SolAccountMeta.from({
    pubkey: new SolPublicKey(SYSVAR_INSTRUCTIONS_ADDRESS),
    isSigner: false,
    isWritable: false,
  });
}

/**
 * Compares two Uint8Arrays for equality.
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * ProgramExec Authority Instructions
 */
export const ProgramExecInstruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getAddAuthorityV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.addAuthority(
      metas,
      {
        ...data,
        authorityPayload: new Uint8Array([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async removeAuthorityV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.removeAuthority(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async updateAuthorityV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getUpdateAuthorityV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.updateAuthority(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async signV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getSignV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metasWithSysvar: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      metasWithSysvar,
      data.innerInstructions,
    );

    return SwigInstructionV1.sign(
      metas,
      {
        roleId: data.roleId,
        authorityPayload: new Uint8Array([sysvarIndex]),
        compactInstructions: compactIxs,
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async signV2Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.swigSystemAddress,
    );

    const baseMetas = getSignV2BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metasWithSysvar: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      metasWithSysvar,
      data.innerInstructions,
      [accounts.swigSystemAddress],
    );

    return SwigInstructionV2.sign(
      metas,
      {
        roleId: data.roleId,
        authorityPayload: new Uint8Array([sysvarIndex]),
        compactInstructions: compactIxs,
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async createSessionV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getCreateSessionV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.createSession(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async subAccountCreateV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getSubAccountCreateV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.subAccountCreate(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async subAccountWithdrawV1SolInstruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.subAccountWithdraw(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async subAccountWithdrawV1TokenInstruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.subAccountWithdraw(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async subAccountToggleV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getSubAccountToggleV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.subAccountToggle(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async subAccountSignV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.subAccount,
    );

    const baseMetas = getSubAccountSignV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metasWithSysvar: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      metasWithSysvar,
      data.innerInstructions,
      [accounts.subAccount],
    );

    return SwigInstructionV1.subAccountSign(
      metas,
      {
        roleId: data.roleId,
        authorityPayload: new Uint8Array([sysvarIndex]),
        compactInstructions: compactIxs,
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },

  async transferAssetsV1Instruction(accounts, data, options) {
    const preInstructions = validateAndGetPreInstructions(
      options,
      new Uint8Array(data.authorityData),
      accounts.swig,
      accounts.payer,
    );

    const baseMetas = getTransferAssetsV1BaseAccountMetas(accounts);
    const sysvarIndex = baseMetas.length;
    const metas: [...typeof baseMetas, SolAccountMeta] = [
      ...baseMetas,
      getInstructionsSysvarMeta(),
    ];

    return SwigInstructionV1.transferAssets(
      metas,
      {
        ...data,
        authorityPayload: Uint8Array.from([sysvarIndex]),
      },
      { preInstructions, postInstructions: options?.postInstructions ?? [] },
    );
  },
};

function validateAndGetPreInstructions(
  options: InstructionDataOptions | undefined,
  authorityData: Uint8Array,
  swig: SolPublicKeyData,
  payerOrSwigSystem: SolPublicKeyData,
): SolInstruction[] {
  if (!options?.preInstructions || options.preInstructions.length !== 1) {
    throw new Error('ProgramExec requires exactly 1 preInstruction');
  }

  const precedingIx = options.preInstructions[0];

  // Decode programId and instructionPrefix from authorityData
  const decoded = getProgramExecDecoder().decode(authorityData);
  const programId = new Uint8Array(decoded.programId);
  const instructionPrefix = new Uint8Array(decoded.instructionPrefix).slice(
    0,
    decoded.instructionPrefixLen,
  );

  // Check programId
  const expectedProgramId = new SolPublicKey(programId);
  if (precedingIx.program.toBase58() !== expectedProgramId.toBase58()) {
    throw new Error(
      `Preceding instruction programId does not match authority. Expected: ${expectedProgramId.toBase58()}, got: ${precedingIx.program.toBase58()}`,
    );
  }

  // Check data prefix
  const dataPrefix = new Uint8Array(precedingIx.data).slice(
    0,
    instructionPrefix.length,
  );
  if (!arraysEqual(dataPrefix, instructionPrefix)) {
    throw new Error(
      'Preceding instruction data does not start with expected prefix',
    );
  }

  // Check accounts contain swig and payer
  const swigPk = new SolPublicKey(swig);
  const payerPk = new SolPublicKey(payerOrSwigSystem);
  const hasSwig = precedingIx.accounts.some(
    (a) => a.publicKey.toBase58() === swigPk.toBase58(),
  );
  const hasPayer = precedingIx.accounts.some(
    (a) => a.publicKey.toBase58() === payerPk.toBase58(),
  );

  if (!hasSwig || !hasPayer) {
    throw new Error(
      'Preceding instruction must include swig and payer/swigSystemAddress accounts',
    );
  }

  return options.preInstructions;
}
