import { hexToBytes } from '@noble/curves/abstract/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
  type Commitment,
} from '@solana/web3.js';
import { SWIG_PROGRAM_ADDRESS } from './consts';

/**
 * Creates a SWIG Instruction with the swig program addresss
 */
export function swigInstruction<T extends AccountMeta[]>(
  accounts: T,
  data: Uint8Array,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: accounts,
    data: Buffer.from(data),
  });
}

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export async function createLegacyTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  options?: { commitment?: Commitment },
): Promise<Transaction> {
  const transaction = new Transaction();

  transaction.instructions = instructions;
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash(options)
  ).blockhash;

  return transaction;
}

/**
 * Utility for deriving a Swig PDA
 * @param id Swig ID
 * @returns [PublicKey, number]
 */
export function findSwigPda(id: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('swig'), Buffer.from(id)],
    SWIG_PROGRAM_ADDRESS,
  );
}

/**
 * Utility for deriving a Swig PDA
 * @param id Swig ID
 * @returns [PublicKey, number]
 */
export function findSwigSubAccountPda(
  swigId: Uint8Array,
  roleId: number,
): [PublicKey, number] {
  const roleIdU32 = new Uint8Array(4);

  const view = new DataView(roleIdU32.buffer);
  view.setUint32(0, roleId, true);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('sub-account'), Buffer.from(swigId), Buffer.from(roleIdU32)],
    SWIG_PROGRAM_ADDRESS,
  );
}

export function compressedPubkeyToAddress(
  compressed: Uint8Array | string,
): Uint8Array {
  const compressedBytes = getUnprefixedSecpBytes(compressed, 33);

  const point = secp256k1.ProjectivePoint.fromHex(compressedBytes);

  const uncompressed = point.toRawBytes(false).slice(1);

  const hash = keccak_256(uncompressed);

  return hash.slice(12);
}

export function getUnprefixedSecpBytes(
  hexOrBytes: Uint8Array | string,
  length: 64 | 33 | 32 | 20,
): Uint8Array {
  const bytes =
    typeof hexOrBytes === 'string'
      ? hexToBytes(unprefixedHexString(hexOrBytes))
      : hexOrBytes;

  return bytes.length === length + 1 ? bytes.slice(1) : bytes;
}

export function unprefixedHexString(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}
