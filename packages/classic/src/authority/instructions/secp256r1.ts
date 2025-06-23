import { keccak_256 } from '@noble/hashes/sha3';
import { getArrayEncoder, getU8Encoder } from '@solana/kit';
import {
  PublicKey,
  TransactionInstruction,
  type AccountMeta,
} from '@solana/web3.js';
import {
  getAccountsPayloadEncoder,
  getAddAuthorityV1AuthorityPayloadEncoder,
  getCompactInstructionEncoder,
  getCreateSessionV1AuthorityPayloadCodec,
  getRemoveAuthorityV1AuthorityPayloadEncoder,
  getSecp256r1SignatureInstructionDataEncoder,
  getSubAccountCreateV1InstructionDataCodec,
  getSubAccountToggleV1InstructionDataCodec,
  getSubAccountWithdrawV1InstructionDataCodec,
} from '@swig-wallet/coder';
import {
  SwigInstructionV1,
  compactInstructions,
  getAddAuthorityV1BaseAccountMetas,
  getRemoveAuthorityV1BaseAccountMetas,
  getSignV1BaseAccountMetasWithSystemProgram,
  getSubAccountCreateV1BaseAccountMetas,
  getSubAccountSignV1BaseAccountMetas,
  getSubAccountToggleV1BaseAccountMetas,
  getSubAccountWithdrawV1SolAccountMetas,
  getSubAccountWithdrawV1TokenAccountMetas,
} from '../../instructions';
import { getCreateSessionV1BaseAccountMetasWithSystemProgram } from '../../instructions/createSessionV1';
import type { AuthorityInstruction, InstructionDataOptions } from './interface';

// For secp256r1, authority payload is 17 bytes: 8 (slot) + 4 (counter) + 1 (instruction index) + 4 (padding)
const SECP256R1_AUTHORITY_PAYLOAD_SIZE = 17;

/**
 * Secp256r1 Authority Instructions
 */
export const Secp256r1Instruction: AuthorityInstruction = {
  async addAuthorityV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const addAuthorityIxAccountMetas =
      getAddAuthorityV1BaseAccountMetas(accounts);

    const authorityPayloadCodec = getAddAuthorityV1AuthorityPayloadEncoder();

    const message = authorityPayloadCodec.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      addAuthorityIxAccountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.addAuthority(
      addAuthorityIxAccountMetas,
      {
        ...data,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async removeAuthorityV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const removeIxAccountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);

    const authorityPayloadCodec = getRemoveAuthorityV1AuthorityPayloadEncoder(
      SECP256R1_AUTHORITY_PAYLOAD_SIZE,
    );

    const message = authorityPayloadCodec.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      removeIxAccountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.removeAuthority(
      removeIxAccountMetas,
      {
        ...data,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async signV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    // Add instructions sysvar account for secp256r1
    const instructionsSysvar: AccountMeta = {
      pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'),
      isSigner: false,
      isWritable: false,
    };

    const signInstructionsAccount = getSignV1BaseAccountMetasWithSystemProgram(
      accounts,
      [instructionsSysvar],
    );

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

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.sign(
      metas,
      {
        roleId: data.roleId,
        authorityPayload,
        compactInstructions: compactIxs,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async createSessionV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const createSessionIxAccountMetas =
      getCreateSessionV1BaseAccountMetasWithSystemProgram(accounts);

    const authorityPayloadCodec = getCreateSessionV1AuthorityPayloadCodec(
      SECP256R1_AUTHORITY_PAYLOAD_SIZE,
    ).codec;

    const message = authorityPayloadCodec.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      createSessionIxAccountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.createSession(
      createSessionIxAccountMetas,
      {
        ...data,
        payloadSize: SECP256R1_AUTHORITY_PAYLOAD_SIZE,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async subAccountCreateV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);

    const { payloadEncoder } = getSubAccountCreateV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      accountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.subAccountCreate(
      accountMetas,
      {
        ...data,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async subAccountSignV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const signInstructionsAccount =
      getSubAccountSignV1BaseAccountMetas(accounts);

    const { accounts: metas, compactIxs } = compactInstructions(
      accounts.swig,
      signInstructionsAccount,
      data.innerInstructions,
      accounts.subAccount,
    );

    const encodedCompactInstructions = getArrayEncoder(
      getCompactInstructionEncoder(),
      {
        size: getU8Encoder(),
      },
    ).encode(compactIxs);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(encodedCompactInstructions),
      metas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.subAccountSign(
      metas,
      {
        roleId: data.roleId,
        compactInstructions: compactIxs,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async subAccountToggleV1Instruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);

    const { payloadEncoder } = getSubAccountToggleV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      accountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.subAccountToggle(
      accountMetas,
      {
        ...data,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async subAccountWithdrawV1SolInstruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const accountMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);

    const { payloadEncoder } = getSubAccountWithdrawV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      accountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.subAccountWithdraw(
      accountMetas,
      {
        ...data,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },

  async subAccountWithdrawV1TokenInstruction(accounts, data, options) {
    if (!options)
      throw new Error(
        'instruction data options not provided for Secp256r1 based authority',
      );

    const accountMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);

    const { payloadEncoder } = getSubAccountWithdrawV1InstructionDataCodec();

    const message = payloadEncoder.encode(data);

    const { authorityPayload, sigVerifyIx } = await prepareSecp256r1Payload(
      Uint8Array.from(message),
      accountMetas,
      new Uint8Array(data.authorityData),
      options,
    );

    return SwigInstructionV1.subAccountWithdraw(
      accountMetas,
      {
        ...data,
        authorityPayload,
      },
      { preInstructions: [sigVerifyIx], postInstructions: [] },
    );
  },
};

export async function prepareSecp256r1Payload(
  dataPayload: Uint8Array,
  accountMetas: AccountMeta[],
  publicKey: Uint8Array,
  options: InstructionDataOptions,
): Promise<{
  authorityPayload: Uint8Array;
  sigVerifyIx: TransactionInstruction;
}> {
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
    accountMetas.map((metas) => ({ ...metas, pubkey: metas.pubkey.toBytes() })),
  );

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

  // For secp256r1, use keccak directly (not sha256+keccak like secp256k1)
  const messageHash = keccak_256(message);

  // Note: For secp256r1, the signature is handled by the secp256r1 precompile instruction
  // The signingFn is called to trigger the signature creation, but we don't use the result here
  const {
    signature,
    prefix,
    message: msg,
  } = await options.signingFn(messageHash);

  const msgHash = msg ?? messageHash;

  const prefixPayload = prefix ?? new Uint8Array(0);

  // Find the instructions sysvar account index
  const instructionSysvarIndex = accountMetas.findIndex(
    (meta) =>
      meta.pubkey.toBase58() === 'Sysvar1nstructions1111111111111111111111111',
  );

  if (instructionSysvarIndex === -1) {
    throw new Error('Instructions sysvar account not found in account metas');
  }

  // For secp256r1, the authority payload structure is:
  // - 8 bytes: slot (little endian)
  // - 4 bytes: counter/odometer (little endian)
  // - 1 byte: instruction sysvar account index
  // - 4 bytes: padding to meet minimum 17 byte requirement
  const authorityPayload = new Uint8Array(
    SECP256R1_AUTHORITY_PAYLOAD_SIZE + prefixPayload.length,
  );
  authorityPayload.set(slot, 0);
  authorityPayload.set(odometer, 8);
  authorityPayload[12] = instructionSysvarIndex;
  // Remaining 4 bytes are padding (already zeroed)
  authorityPayload.set(prefixPayload, SECP256R1_AUTHORITY_PAYLOAD_SIZE);

  const instData = getSecp256r1SignatureInstructionDataEncoder().encode({
    message: msgHash,
    publicKey,
    signature,
  });

  const sigVerifyIx: TransactionInstruction = {
    programId: new PublicKey('Secp256r1SigVerify1111111111111111111111111'),
    data: Buffer.from(instData),
    keys: [],
  };

  return { authorityPayload, sigVerifyIx };
}
