import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

import type {
  ClientSignatureRequest,
  PasskeySigningFn,
  PreparedTransaction,
  Secp256k1SigningFn,
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
const SECP256K1_AUTHORITY_PAYLOAD_SIZE = 77;
const SECP256K1_SIGNATURE_SIZE = 65;
const SECP256K1_SIGNATURE_OFFSET = 12;
const U16_MAX = 65535;

export type Secp256r1SigningFns =
  | PasskeySigningFn
  | Record<string, PasskeySigningFn>;
export type Secp256k1SigningFns =
  | Secp256k1SigningFn
  | Record<string, Secp256k1SigningFn>;

export interface SignPreparedSwigTransactionOptions {
  secp256r1?: Secp256r1SigningFns;
  secp256k1?: Secp256k1SigningFns;
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
  switch (request.scheme) {
    case 'secp256r1':
      await applySecp256r1SignatureRequest(transaction, request, options);
      return;
    case 'secp256k1':
      await applySecp256k1SignatureRequest(transaction, request, options);
      return;
  }
}

async function applySecp256r1SignatureRequest(
  transaction: SwigTransaction,
  request: ClientSignatureRequest,
  options: SignPreparedSwigTransactionOptions,
) {
  if (!options.secp256r1) {
    throw new Error('No secp256r1 signing function registered');
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
      patchSignV2AuthorityPayloadPrefix(
        getInstructionData(transaction, signV2InstructionIndex),
        signingResult.prefix,
        SECP256R1_AUTHORITY_PAYLOAD_SIZE,
        'secp256r1',
      ),
    );
  }
}

async function applySecp256k1SignatureRequest(
  transaction: SwigTransaction,
  request: ClientSignatureRequest,
  options: SignPreparedSwigTransactionOptions,
) {
  if (!options.secp256k1) {
    throw new Error('No secp256k1 signing function registered');
  }

  const signingFn = resolveSecp256k1SigningFn(request, options.secp256k1);
  const message = asciiToBytes(normalizeHex(request.messageHash));
  const signingResult = await signingFn(message);

  if (signingResult.signature.length !== SECP256K1_SIGNATURE_SIZE) {
    throw new Error('Secp256k1 signature must be 65 bytes');
  }

  const signV2InstructionIndex = findSignV2InstructionIndexForSecp256k1(
    transaction,
    request,
  );
  setInstructionData(
    transaction,
    signV2InstructionIndex,
    patchSignV2Secp256k1AuthorityPayload(
      getInstructionData(transaction, signV2InstructionIndex),
      request,
      signingResult.signature,
      signingResult.prefix,
    ),
  );
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

function resolveSecp256k1SigningFn(
  request: ClientSignatureRequest,
  signingFns: Secp256k1SigningFns,
): Secp256k1SigningFn {
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
      `No secp256k1 signing function registered for signer ${request.signer}`,
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

function findSignV2InstructionIndexForSecp256k1(
  transaction: SwigTransaction,
  request: ClientSignatureRequest,
): number {
  const fallbackIndexes: number[] = [];

  for (let index = 0; index < instructionCount(transaction); index++) {
    if (!getInstructionProgramId(transaction, index).equals(SWIG_PROGRAM_ID)) {
      continue;
    }

    const instructionData = getInstructionData(transaction, index);
    if (readU16(instructionData, 0) !== SIGN_V2_DISCRIMINATOR) {
      continue;
    }

    const authorityPayloadOffset =
      getSignV2AuthorityPayloadOffset(instructionData);
    if (
      instructionData.length <
      authorityPayloadOffset + SECP256K1_AUTHORITY_PAYLOAD_SIZE
    ) {
      continue;
    }

    fallbackIndexes.push(index);

    if (
      readU64(instructionData, authorityPayloadOffset) ===
        BigInt(request.slot) &&
      readU32(instructionData, authorityPayloadOffset + 8) === request.counter
    ) {
      return index;
    }
  }

  if (fallbackIndexes.length === 1) {
    return fallbackIndexes[0];
  }

  throw new Error('Matching secp256k1 Swig SignV2 instruction not found');
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

function patchSignV2AuthorityPayloadPrefix(
  instructionData: Uint8Array,
  prefix: Uint8Array,
  fixedPayloadSize: number,
  scheme: string,
): Uint8Array {
  const authorityPayloadOffset =
    getSignV2AuthorityPayloadOffset(instructionData);

  if (instructionData.length < authorityPayloadOffset + fixedPayloadSize) {
    throw new Error(
      `Swig SignV2 instruction is missing ${scheme} authority payload`,
    );
  }

  const fixedPayloadEnd = authorityPayloadOffset + fixedPayloadSize;
  const patched = new Uint8Array(fixedPayloadEnd + prefix.length);
  patched.set(instructionData.slice(0, fixedPayloadEnd));
  patched.set(prefix, fixedPayloadEnd);

  return patched;
}

function patchSignV2Secp256k1AuthorityPayload(
  instructionData: Uint8Array,
  request: ClientSignatureRequest,
  signature: Uint8Array,
  prefix?: Uint8Array,
): Uint8Array {
  const authorityPayloadOffset =
    getSignV2AuthorityPayloadOffset(instructionData);

  if (
    instructionData.length <
    authorityPayloadOffset + SECP256K1_AUTHORITY_PAYLOAD_SIZE
  ) {
    throw new Error(
      'Swig SignV2 instruction is missing secp256k1 authority payload',
    );
  }

  if (!Number.isSafeInteger(request.slot) || request.slot < 0) {
    throw new Error('Secp256k1 signature request slot must be a safe integer');
  }

  if (
    !Number.isSafeInteger(request.counter) ||
    request.counter < 0 ||
    request.counter > 0xffffffff
  ) {
    throw new Error('Secp256k1 signature request counter must fit in u32');
  }

  const fixedPayloadEnd =
    authorityPayloadOffset + SECP256K1_AUTHORITY_PAYLOAD_SIZE;
  const prefixPayload = prefix ?? new Uint8Array(0);
  const patched = new Uint8Array(fixedPayloadEnd + prefixPayload.length);
  patched.set(instructionData.slice(0, fixedPayloadEnd));

  const view = new DataView(patched.buffer, patched.byteOffset);
  view.setBigUint64(authorityPayloadOffset, BigInt(request.slot), true);
  view.setUint32(authorityPayloadOffset + 8, request.counter, true);
  patched.set(signature, authorityPayloadOffset + SECP256K1_SIGNATURE_OFFSET);
  patched.set(prefixPayload, fixedPayloadEnd);

  return patched;
}

function getSignV2AuthorityPayloadOffset(instructionData: Uint8Array): number {
  return 8 + readU16(instructionData, 2);
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

function readU32(data: Uint8Array, offset: number): number {
  if (data.length < offset + 4) {
    throw new Error('Instruction data is too short');
  }
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    offset,
    true,
  );
}

function readU64(data: Uint8Array, offset: number): bigint {
  if (data.length < offset + 8) {
    throw new Error('Instruction data is too short');
  }
  return new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getBigUint64(offset, true);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function asciiToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index++) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
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
