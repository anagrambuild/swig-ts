import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, toBytes } from '@noble/hashes/utils';
import { getArrayEncoder, getU8Encoder } from '@solana/kit';
import {
  getAccountsPayloadEncoder,
  getAddAuthorityV1AuthorityPayloadEncoder,
  getCompactInstructionEncoder,
  getCreateSessionV1AuthorityPayloadCodec,
  getRemoveAuthorityV1AuthorityPayloadEncoder,
  getSubAccountCreateV1InstructionDataCodec,
  getSubAccountToggleV1InstructionDataCodec,
  getSubAccountWithdrawV1InstructionDataCodec,
  getTransferAssetsV1InstructionDataCodec,
  getUpdateAuthorityV1AuthorityPayloadEncoder,
} from '@swig-wallet/coder';
import {
  SwigInstructionV1,
  SwigInstructionV2,
  compactInstructions,
  getAddAuthorityV1BaseAccountMetas,
  getCreateSessionV1BaseAccountMetasWithSystemProgram,
  getRemoveAuthorityV1BaseAccountMetas,
  getSignV1BaseAccountMetas,
  getSignV2BaseAccountMetas,
  getSubAccountCreateV1BaseAccountMetas,
  getSubAccountSignV1BaseAccountMetas,
  getSubAccountToggleV1BaseAccountMetas,
  getSubAccountWithdrawV1AccountMetasWithSystemProgram,
  getSubAccountWithdrawV1SolAccountMetas,
  getSubAccountWithdrawV1TokenAccountMetas,
  getTransferAssetsV1BaseAccountMetas,
  getUpdateAuthorityV1BaseAccountMetas,
} from '../../instructions';
import { SolAccountMeta } from '../../solana';
import type { AuthorityInstruction, SigningFn } from './interface';

/**
 * Secp256k1 Authority Instructions
 */
export const Secp256k1Instruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const addAuthorityIxAccountMetas =
      getAddAuthorityV1BaseAccountMetas(accounts);

    const authorityPayloadCodec = getAddAuthorityV1AuthorityPayloadEncoder();

    const message = authorityPayloadCodec.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      addAuthorityIxAccountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.addAuthority(addAuthorityIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async removeAuthorityV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const removeIxAccountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);

    const authorityPayloadCodec = getRemoveAuthorityV1AuthorityPayloadEncoder(
      SECP_AUTHORITY_PAYLOAD_SIZE,
    );

    const message = authorityPayloadCodec.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      removeIxAccountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.removeAuthority(removeIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async updateAuthorityV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const metas = getUpdateAuthorityV1BaseAccountMetas(accounts);

    const authorityPayloadCodec = getUpdateAuthorityV1AuthorityPayloadEncoder();

    const message = authorityPayloadCodec.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      metas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.updateAuthority(metas, {
      ...data,
      authorityPayload,
    });
  },

  async signV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const signInstructionsAccount = getSignV1BaseAccountMetas(accounts);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
    );

    const encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.sign(metas, {
      roleId: data.roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },

  async signV2Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const signInstructionsAccount = getSignV2BaseAccountMetas(accounts);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
      [accounts.swigSystemAddress],
    );

    const encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV2.sign(metas, {
      roleId: data.roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },

  async createSessionV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const createSessionIxAccountMetas =
      getCreateSessionV1BaseAccountMetasWithSystemProgram(accounts);

    const authorityPayloadCodec =
      getCreateSessionV1AuthorityPayloadCodec().codec;

    const message = authorityPayloadCodec.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      createSessionIxAccountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.createSession(createSessionIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountCreateV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);

    const { payloadEncoder } = getSubAccountCreateV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.subAccountCreate(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountSignV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const signInstructionsAccount =
      getSubAccountSignV1BaseAccountMetas(accounts);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
      [accounts.subAccount],
    );

    const encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.subAccountSign(metas, {
      roleId: data.roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },

  async subAccountWithdrawV1SolInstruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const baseMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);
    const accountMetas = getSubAccountWithdrawV1AccountMetasWithSystemProgram(
      baseMetas,
      baseMetas.length,
    );

    const { payloadEncoder } = getSubAccountWithdrawV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.subAccountWithdraw(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountWithdrawV1TokenInstruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const baseMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
    const accountMetas = getSubAccountWithdrawV1AccountMetasWithSystemProgram(
      baseMetas,
      baseMetas.length,
    );

    const { payloadEncoder } = getSubAccountWithdrawV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.subAccountWithdraw(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountToggleV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);

    const { payloadEncoder } = getSubAccountToggleV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.subAccountToggle(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async transferAssetsV1Instruction(accounts, data, options) {
    if (!options?.signingFn || options?.currentSlot === undefined)
      throw new Error(
        'Current slot or Signing function not provided for Secp256k1 based authority',
      );

    const accountMetas = getTransferAssetsV1BaseAccountMetas(accounts);

    const { payloadEncoder } = getTransferAssetsV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      {
        signingFn: options.signingFn,
        odometer: options.odometer,
        currentSlot: options.currentSlot,
      },
    );

    return SwigInstructionV1.transferAssets(accountMetas, {
      ...data,
      authorityPayload,
    });
  },
};

/**
 * Prepare Secp authority payload for instruction
 * @param dataPayload message bytes
 * @param accountMetas Instruction AccountMetas
 * @param options {@link InstructionDataOptions}
 * @returns Authority Payload bytes
 */
export async function prepareSecpPayload(
  dataPayload: Uint8Array,
  accountMetas: SolAccountMeta[],
  options: {
    signingFn: SigningFn;
    currentSlot: bigint;
    odometer?: number;
  },
): Promise<Uint8Array> {
  const u64Len = 8;

  const slot = new Uint8Array(u64Len);

  const slotView = new DataView(slot.buffer);
  slotView.setBigUint64(0, options.currentSlot, true);

  const odometer = new Uint8Array(4);

  const odometerView = new DataView(odometer.buffer);
  odometerView.setUint32(0, options.odometer ?? 1, true);

  const accountsPayloadBytes = getAccountsPayloadEncoder(
    accountMetas.length,
  ).encode(
    accountMetas.map((acct) => ({
      ...acct.toWeb3AccountMeta(),
      pubkey: acct.publicKey.toBytes(),
    })),
  );

  const message = new Uint8Array(
    dataPayload.length + accountsPayloadBytes.length + u64Len + odometer.length,
  );
  message.set(dataPayload);
  message.set(accountsPayloadBytes, dataPayload.length);
  message.set(slot, dataPayload.length + accountsPayloadBytes.length);
  message.set(
    odometer,
    dataPayload.length + accountsPayloadBytes.length + +u64Len,
  );

  const messageShaHash = sha256(message);
  const messageHashHex = bytesToHex(messageShaHash);

  const { signature, prefix } = await options.signingFn(
    toBytes(messageHashHex),
  );

  const prefixPayload = prefix ?? new Uint8Array(0);

  const authorityPayload = new Uint8Array(
    signature.length + u64Len + odometer.length + prefixPayload.length,
  );
  authorityPayload.set(slot);
  authorityPayload.set(odometer, slot.length);
  authorityPayload.set(signature, slot.length + odometer.length);
  authorityPayload.set(
    prefixPayload,
    slot.length + odometer.length + signature.length,
  );

  return authorityPayload;
}

// For secp256k1, authority payload is 77 bytes: 8 (slot) + 4 (counter) + 65 (signature)
const SECP_AUTHORITY_PAYLOAD_SIZE = 77;
