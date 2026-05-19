import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

import type {
  ClientSignatureRequest,
  PasskeySigningFn,
  PreparedTransaction,
} from '../types/index.js';
import type { SignedPreparedTransaction } from './index.js';

const SECP256R1_PROGRAM_ID = new PublicKey(
  'Secp256r1SigVerify1111111111111111111111111',
);
const SWIG_PROGRAM_ID = new PublicKey(
  'swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB',
);
const SIGN_V2_DISCRIMINATOR = 11;
const SECP256R1_AUTHORITY_PAYLOAD_SIZE = 17;
const SECP256R1_PUBLIC_KEY_SIZE = 33;
const SECP256R1_SIGNATURE_SIZE = 64;
const SECP256R1_HEADER_SIZE = 16;
const U16_MAX = 65535;

export type Secp256r1SigningFns =
  | PasskeySigningFn
  | Record<string, PasskeySigningFn>;

export interface SignPreparedSwigTransactionOptions {
  secp256r1: Secp256r1SigningFns;
}

type SwigTransaction = Transaction | VersionedTransaction;

export async function signPreparedSwigTransaction(
  prepared: PreparedTransaction,
  options: SignPreparedSwigTransactionOptions,
): Promise<SignedPreparedTransaction> {
  if (
    prepared.transactionEncoding !== undefined &&
    prepared.transactionEncoding !== 'base64'
  ) {
    throw new Error('Only base64 prepared transactions can be signed');
  }

  const transaction = deserializeTransaction(
    base64ToBytes(prepared.transaction),
  );

  for (const request of prepared.signatureRequests) {
    await applySignatureRequest(transaction, request, options);
  }

  return {
    transaction: bytesToBase64(serializeTransaction(transaction)),
    transactionEncoding: prepared.transactionEncoding ?? 'base64',
    network: prepared.network,
  };
}

export async function signPreparedSwigTransactions(
  preparedTransactions: PreparedTransaction[],
  options: SignPreparedSwigTransactionOptions,
): Promise<SignedPreparedTransaction[]> {
  const signedTransactions: SignedPreparedTransaction[] = [];

  for (const prepared of preparedTransactions) {
    signedTransactions.push(
      await signPreparedSwigTransaction(prepared, options),
    );
  }

  return signedTransactions;
}

async function applySignatureRequest(
  transaction: SwigTransaction,
  request: ClientSignatureRequest,
  options: SignPreparedSwigTransactionOptions,
) {
  if (request.scheme !== 'secp256r1') {
    throw new Error(
      `Client signing for ${request.scheme} prepared transactions is not supported yet`,
    );
  }

  const publicKey = hexToBytes(request.signer);
  if (publicKey.length !== SECP256R1_PUBLIC_KEY_SIZE) {
    throw new Error('Secp256r1 signature request signer must be 33 bytes');
  }

  const messageHash = hexToBytes(request.messageHash);
  const signingFn = resolveSecp256r1SigningFn(request, options.secp256r1);
  const signingResult = await signingFn(messageHash);

  if (signingResult.signature.length !== SECP256R1_SIGNATURE_SIZE) {
    throw new Error('Secp256r1 signature must be 64 bytes');
  }

  const signedMessage = signingResult.message ?? messageHash;
  const secpInstructionIndex = findSecp256r1InstructionIndex(
    transaction,
    publicKey,
    messageHash,
  );

  setInstructionData(
    transaction,
    secpInstructionIndex,
    encodeSecp256r1SignatureInstruction({
      publicKey,
      signature: signingResult.signature,
      message: signedMessage,
    }),
  );

  if (signingResult.prefix !== undefined) {
    const signV2InstructionIndex = findFollowingSignV2InstructionIndex(
      transaction,
      secpInstructionIndex,
    );
    setInstructionData(
      transaction,
      signV2InstructionIndex,
      patchSignV2AuthorityPayload(
        getInstructionData(transaction, signV2InstructionIndex),
        signingResult.prefix,
      ),
    );
  }
}

function resolveSecp256r1SigningFn(
  request: ClientSignatureRequest,
  signingFns: Secp256r1SigningFns,
): PasskeySigningFn {
  if (typeof signingFns === 'function') {
    return signingFns;
  }

  const normalizedSigner = normalizeHex(request.signer);
  const signingFn =
    signingFns[normalizedSigner] ??
    signingFns[`0x${normalizedSigner}`] ??
    signingFns[request.signer];

  if (!signingFn) {
    throw new Error(
      `No secp256r1 signing function registered for signer ${request.signer}`,
    );
  }

  return signingFn;
}

function deserializeTransaction(bytes: Uint8Array): SwigTransaction {
  try {
    return Transaction.from(bytes);
  } catch {
    return VersionedTransaction.deserialize(bytes);
  }
}

function serializeTransaction(transaction: SwigTransaction): Uint8Array {
  if (transaction instanceof VersionedTransaction) {
    return transaction.serialize();
  }

  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
}

function findSecp256r1InstructionIndex(
  transaction: SwigTransaction,
  publicKey: Uint8Array,
  messageHash: Uint8Array,
): number {
  for (let index = 0; index < instructionCount(transaction); index++) {
    if (
      !getInstructionProgramId(transaction, index).equals(SECP256R1_PROGRAM_ID)
    ) {
      continue;
    }

    const parsed = parseSecp256r1SignatureInstruction(
      getInstructionData(transaction, index),
    );

    if (
      parsed &&
      bytesEqual(parsed.publicKey, publicKey) &&
      bytesEqual(parsed.message, messageHash)
    ) {
      return index;
    }
  }

  throw new Error('Matching secp256r1 signature instruction not found');
}

function findFollowingSignV2InstructionIndex(
  transaction: SwigTransaction,
  secpInstructionIndex: number,
): number {
  for (
    let index = secpInstructionIndex + 1;
    index < instructionCount(transaction);
    index++
  ) {
    if (!getInstructionProgramId(transaction, index).equals(SWIG_PROGRAM_ID)) {
      continue;
    }

    if (
      readU16(getInstructionData(transaction, index), 0) ===
      SIGN_V2_DISCRIMINATOR
    ) {
      return index;
    }
  }

  throw new Error(
    'Swig SignV2 instruction following secp256r1 precompile not found',
  );
}

function encodeSecp256r1SignatureInstruction(args: {
  publicKey: Uint8Array;
  signature: Uint8Array;
  message: Uint8Array;
}): Uint8Array {
  const messageOffset =
    SECP256R1_HEADER_SIZE +
    SECP256R1_PUBLIC_KEY_SIZE +
    SECP256R1_SIGNATURE_SIZE;
  const data = new Uint8Array(messageOffset + args.message.length);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  data[0] = 1;
  data[1] = 0;
  view.setUint16(2, SECP256R1_HEADER_SIZE + SECP256R1_PUBLIC_KEY_SIZE, true);
  view.setUint16(4, U16_MAX, true);
  view.setUint16(6, SECP256R1_HEADER_SIZE, true);
  view.setUint16(8, U16_MAX, true);
  view.setUint16(10, messageOffset, true);
  view.setUint16(12, args.message.length, true);
  view.setUint16(14, U16_MAX, true);
  data.set(args.publicKey, SECP256R1_HEADER_SIZE);
  data.set(args.signature, SECP256R1_HEADER_SIZE + SECP256R1_PUBLIC_KEY_SIZE);
  data.set(args.message, messageOffset);

  return data;
}

function parseSecp256r1SignatureInstruction(data: Uint8Array):
  | {
      publicKey: Uint8Array;
      message: Uint8Array;
    }
  | undefined {
  if (data.length < SECP256R1_HEADER_SIZE || data[0] !== 1) {
    return undefined;
  }

  const publicKeyOffset = readU16(data, 6);
  const messageOffset = readU16(data, 10);
  const messageSize = readU16(data, 12);

  if (
    data.length < publicKeyOffset + SECP256R1_PUBLIC_KEY_SIZE ||
    data.length < messageOffset + messageSize
  ) {
    return undefined;
  }

  return {
    publicKey: data.slice(
      publicKeyOffset,
      publicKeyOffset + SECP256R1_PUBLIC_KEY_SIZE,
    ),
    message: data.slice(messageOffset, messageOffset + messageSize),
  };
}

function patchSignV2AuthorityPayload(
  instructionData: Uint8Array,
  prefix: Uint8Array,
): Uint8Array {
  const instructionPayloadLength = readU16(instructionData, 2);
  const authorityPayloadOffset = 8 + instructionPayloadLength;

  if (
    instructionData.length <
    authorityPayloadOffset + SECP256R1_AUTHORITY_PAYLOAD_SIZE
  ) {
    throw new Error(
      'Swig SignV2 instruction is missing secp256r1 authority payload',
    );
  }

  const fixedPayloadEnd =
    authorityPayloadOffset + SECP256R1_AUTHORITY_PAYLOAD_SIZE;
  const patched = new Uint8Array(fixedPayloadEnd + prefix.length);
  patched.set(instructionData.slice(0, fixedPayloadEnd));
  patched.set(prefix, fixedPayloadEnd);

  return patched;
}

function instructionCount(transaction: SwigTransaction): number {
  if (transaction instanceof VersionedTransaction) {
    return transaction.message.compiledInstructions.length;
  }

  return transaction.instructions.length;
}

function getInstructionProgramId(
  transaction: SwigTransaction,
  index: number,
): PublicKey {
  if (transaction instanceof VersionedTransaction) {
    const instruction = transaction.message.compiledInstructions[index];
    const programId =
      transaction.message.staticAccountKeys[instruction.programIdIndex];
    if (!programId) {
      throw new Error(
        'Versioned transaction program id is not statically available',
      );
    }
    return programId;
  }

  return transaction.instructions[index].programId;
}

function getInstructionData(
  transaction: SwigTransaction,
  index: number,
): Uint8Array {
  if (transaction instanceof VersionedTransaction) {
    return transaction.message.compiledInstructions[index].data;
  }

  return new Uint8Array(transaction.instructions[index].data);
}

function setInstructionData(
  transaction: SwigTransaction,
  index: number,
  data: Uint8Array,
) {
  if (transaction instanceof VersionedTransaction) {
    transaction.message.compiledInstructions[index].data = data;
    return;
  }

  transaction.instructions[index].data = data as Buffer;
}

function hexToBytes(value: string): Uint8Array {
  const normalized = normalizeHex(value);
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex strings must contain an even number of characters');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function normalizeHex(value: string): string {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[\da-fA-F]+$/.test(normalized)) {
    throw new Error('Invalid hex string');
  }
  return normalized.toLowerCase();
}

function readU16(data: Uint8Array, offset: number): number {
  if (data.length < offset + 2) {
    throw new Error('Instruction data is too short');
  }
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(
    offset,
    true,
  );
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}
