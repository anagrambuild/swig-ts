import { keccak_256 } from '@noble/hashes/sha3';
import { getArrayEncoder, getU8Encoder } from '@solana/kit';
import type { AccountMeta } from '@solana/web3.js';
import {
  getAccountsPayloadEncoder,
  getAddAuthorityV1AuthorityPayloadEncoder,
  getCompactInstructionEncoder,
  getCreateSessionV1AuthorityPayloadCodec,
  getRemoveAuthorityV1AuthorityPayloadEncoder,
} from '@swig/coder';
import {
  SwigInstructionV1,
  compactInstructions,
  getAddAuthorityV1BaseAccountMetas,
  getRemoveAuthorityV1BaseAccountMetas,
  getSignV1BaseAccountMetas,
} from '../../instructions';
import { getCreateSessionV1BaseAccountMetasWithSystemProgram } from '../../instructions/createSessionV1';
import type { AuthorityInstruction, InstructionDataOptions } from './interface';

/**
 * Secp256k1 Authority Instructions
 */
export const Secp256k1Instruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );

    let addAuthorityIxAccountMetas =
      getAddAuthorityV1BaseAccountMetas(accounts);

    let authorityPayloadCodec = getAddAuthorityV1AuthorityPayloadEncoder();

    let message = authorityPayloadCodec.encode(data);

    let authorityPayload = await prepareSecpPayload(
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
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );

    let removeIxAccountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);

    let authorityPayloadCodec = getRemoveAuthorityV1AuthorityPayloadEncoder(
      SECP_AUTHORITY_PAYLOAD_SIZE,
    );

    let message = authorityPayloadCodec.encode(data);

    let authorityPayload = await prepareSecpPayload(
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
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );

    let signInstructionsAccount = getSignV1BaseAccountMetas(accounts);

    let { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
    );

    let encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    let authorityPayload = await prepareSecpPayload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      options,
    );

    return SwigInstructionV1.sign(metas, {
      roleId: data.roleId,
      authorityPayload,
      compactInstructions: compactIxs,
    });
  },

  async createSessionV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256k1 based authority',
      );

    let createSessionIxAccountMetas =
      getCreateSessionV1BaseAccountMetasWithSystemProgram(accounts);

    let authorityPayloadCodec =
      getCreateSessionV1AuthorityPayloadCodec(1).codec;

    let message = authorityPayloadCodec.encode(data);

    let authorityPayload = await prepareSecpPayload(
      Uint8Array.from(message),
      createSessionIxAccountMetas,
      options,
    );

    return SwigInstructionV1.createSession(createSessionIxAccountMetas, {
      ...data,
      payloadSize: 1,
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
  accountMetas: AccountMeta[],
  options: InstructionDataOptions,
): Promise<Uint8Array> {
  let u64Len = 8;

  let slot = new Uint8Array(u64Len);

  let view = new DataView(slot.buffer);
  view.setBigUint64(0, options.currentSlot, true);

  let accountsPayloadBytes = getAccountsPayloadEncoder(
    accountMetas.length,
  ).encode(
    accountMetas.map((metas) => ({ ...metas, pubkey: metas.pubkey.toBytes() })),
  );

  const message = new Uint8Array(
    dataPayload.length + accountsPayloadBytes.length + u64Len,
  );
  message.set(dataPayload);
  message.set(accountsPayloadBytes, dataPayload.length);
  message.set(slot, dataPayload.length + accountsPayloadBytes.length);

  const hash = keccak_256(message);

  let sig = await options.signingFn(hash);

  const authorityPayload = new Uint8Array(sig.length + u64Len);

  authorityPayload.set(slot);
  authorityPayload.set(sig, slot.length);

  return authorityPayload;
}

const SECP_AUTHORITY_PAYLOAD_SIZE = 65;
