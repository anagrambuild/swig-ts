import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, toBytes } from '@noble/hashes/utils';
import {
  AccountRole,
  getArrayEncoder,
  getU8Encoder,
  type Address,
  type IInstruction,
} from '@solana/kit';
import {
  getAccountsPayloadEncoder,
  getAddAuthorityV1AuthorityPayloadEncoder,
  getCompactInstructionEncoder,
  getCreateSessionV1AuthorityPayloadCodec,
  getRemoveAuthorityV1AuthorityPayloadEncoder,
  getSubAccountCreateV1InstructionDataCodec,
  getSubAccountToggleV1InstructionDataCodec,
  getSubAccountWithdrawV1InstructionDataCodec,
} from '@swig-wallet/coder';
import bs58 from 'bs58';
import {
  SwigInstructionV1,
  compactInstructions,
  getAddAuthorityV1BaseAccountMetas,
  getRemoveAuthorityV1BaseAccountMetas,
  getSignV1BaseAccountMetas,
  getSubAccountCreateV1BaseAccountMetas,
  getSubAccountSignV1BaseAccountMetas,
  getSubAccountToggleV1BaseAccountMetas,
  getSubAccountWithdrawV1SolAccountMetas,
  getSubAccountWithdrawV1TokenAccountMetas,
} from '../../instructions';
import { getCreateSessionV1BaseAccountMetasWithSystemProgram } from '../../instructions/createSessionV1';
import type { AuthorityInstruction, InstructionDataOptions } from './interface';

// Define the expected account meta type for kit
interface KitAccountMeta {
  address: Address;
  role: AccountRole;
}

// Helper function to convert kit account meta to the format expected by the encoder
function convertKitAccountMeta(meta: KitAccountMeta) {
  // Convert address string to Uint8Array using bs58 decode
  const pubkey = bs58.decode(meta.address);

  // Convert role to boolean flags
  const isWritable =
    meta.role === AccountRole.WRITABLE ||
    meta.role === AccountRole.WRITABLE_SIGNER;
  const isSigner =
    meta.role === AccountRole.READONLY_SIGNER ||
    meta.role === AccountRole.WRITABLE_SIGNER;

  return {
    pubkey,
    isWritable,
    isSigner,
  };
}

/**
 * Secp256k1 Authority Instructions (kit-native)
 */
export const Secp256k1Instruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const addAuthorityIxAccountMetas =
      getAddAuthorityV1BaseAccountMetas(accounts);
    const {
      actingRoleId,
      newAuthorityType,
      noOfActions,
      newAuthorityData,
      actions,
    } = data;

    const codecData = {
      actingRoleId,
      newAuthorityType,
      noOfActions,
      newAuthorityData,
      actions,
    };

    const authorityPayloadCodec = getAddAuthorityV1AuthorityPayloadEncoder();
    const message = authorityPayloadCodec.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      addAuthorityIxAccountMetas,
      options,
    );

    return SwigInstructionV1.addAuthority(addAuthorityIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async removeAuthorityV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const removeIxAccountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);
    const { actingRoleId, authorityToRemoveId } = data;
    const codecData = { actingRoleId, authorityToRemoveId };

    const authorityPayloadCodec = getRemoveAuthorityV1AuthorityPayloadEncoder(
      SECP_AUTHORITY_PAYLOAD_SIZE,
    );
    const message = authorityPayloadCodec.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      removeIxAccountMetas,
      options,
    );

    return SwigInstructionV1.removeAuthority(removeIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async signV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const signInstructionsAccount = getSignV1BaseAccountMetas(accounts);
    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions as IInstruction[],
    );
    const { roleId } = data;

    const encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      options,
    );

    return SwigInstructionV1.sign(metas, {
      roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },

  async createSessionV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const createSessionIxAccountMetas =
      getCreateSessionV1BaseAccountMetasWithSystemProgram(accounts);
    const { roleId, sessionDuration, sessionKey } = data;
    const codecData = { roleId, sessionDuration, sessionKey };

    const authorityPayloadCodec =
      getCreateSessionV1AuthorityPayloadCodec().codec;
    const message = authorityPayloadCodec.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      createSessionIxAccountMetas,
      options,
    );

    return SwigInstructionV1.createSession(createSessionIxAccountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountCreateV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);
    const { roleId, bump } = data;
    const codecData = { roleId, bump };

    const { payloadEncoder } = getSubAccountCreateV1InstructionDataCodec();
    const message = payloadEncoder.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      options,
    );

    return SwigInstructionV1.subAccountCreate(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountSignV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const signInstructionsAccount =
      getSubAccountSignV1BaseAccountMetas(accounts);
    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions as IInstruction[],
      accounts.subAccount,
    );
    const { roleId } = data;

    const encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      options,
    );

    return SwigInstructionV1.subAccountSign(metas, {
      roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },

  async subAccountWithdrawV1SolInstruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const accountMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);
    const { roleId, amount } = data;
    const codecData = { roleId, amount };

    const { payloadEncoder } = getSubAccountWithdrawV1InstructionDataCodec();
    const message = payloadEncoder.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      options,
    );

    return SwigInstructionV1.subAccountWithdraw(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountWithdrawV1TokenInstruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const accountMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
    const { roleId, amount } = data;
    const codecData = { roleId, amount };

    const { payloadEncoder } = getSubAccountWithdrawV1InstructionDataCodec();
    const message = payloadEncoder.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      options,
    );

    return SwigInstructionV1.subAccountWithdraw(accountMetas, {
      ...data,
      authorityPayload,
    });
  },

  async subAccountToggleV1Instruction(accounts, data, options) {
    if (!options) {
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );
    }

    const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);
    const { enabled, roleId } = data;
    const codecData = { enabled, roleId };

    const { payloadEncoder } = getSubAccountToggleV1InstructionDataCodec();
    const message = payloadEncoder.encode(codecData);
    const authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      accountMetas,
      options,
    );

    return SwigInstructionV1.subAccountToggle(accountMetas, {
      ...data,
      authorityPayload,
    });
  },
};

/**
 * Prepares the authority payload for a Secp256k1-based instruction.
 * @param dataPayload The message or instruction data to be signed, as a Uint8Array.
 * @param accountMetas An array of KitAccountMeta objects representing the accounts involved in the instruction.
 * @param options Additional instruction data options, including the current slot and a signing function.
 * @returns A Promise that resolves to the authority payload as a Uint8Array.
 */
export async function prepareSecpPayload(
  dataPayload: Uint8Array,
  accountMetas: KitAccountMeta[],
  options: InstructionDataOptions,
): Promise<Uint8Array> {
  const u64Len = 8;
  const slot = new Uint8Array(u64Len);
  const slotView = new DataView(slot.buffer);
  slotView.setBigUint64(0, options.currentSlot, true);

  const odometer = new Uint8Array(4);

  const odometerView = new DataView(odometer.buffer);
  odometerView.setUint32(0, options.odometer ?? 1, true);

  // Convert Kit account metas to the format expected by the encoder
  const convertedMetas = accountMetas.map(convertKitAccountMeta);

  const accountsPayloadBytes = getAccountsPayloadEncoder(
    convertedMetas.length,
  ).encode(convertedMetas);

  // Message to be signed: [dataPayload][accountsPayload][slot][odometer]
  const message = new Uint8Array(
    dataPayload.length + accountsPayloadBytes.length + u64Len + odometer.length,
  );
  message.set(dataPayload);
  message.set(accountsPayloadBytes, dataPayload.length);
  message.set(slot, dataPayload.length + accountsPayloadBytes.length);
  message.set(
    odometer,
    dataPayload.length + accountsPayloadBytes.length + u64Len,
  );

  const messageShaHash = sha256(message);
  const messageHashHex = bytesToHex(messageShaHash);

  const { signature, prefix } = await options.signingFn(
    toBytes(messageHashHex),
  );

  const prefixPayload = prefix ?? new Uint8Array(0);

  // Final authority payload: [slot][odometer][signature][prefixPayload]
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

const SECP_AUTHORITY_PAYLOAD_SIZE = 65;
