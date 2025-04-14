import { address } from '@solana/addresses';
import { AccountRole } from '@solana/instructions';
import { type IAccountMeta } from '@solana/kit';

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
export function swigInstuction<T extends AccountMeta[]>(
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

export function convertKeysToMetas(meta: AccountMeta): IAccountMeta {
  return {
    address: address(meta.pubkey.toBase58()),
    role: getRoleFromMetas(meta),
  };
}

export function getRoleFromMetas({
  isSigner,
  isWritable,
}: {
  isSigner: boolean;
  isWritable: boolean;
}) {
  if (isWritable && isSigner) {
    return AccountRole.WRITABLE_SIGNER;
  }
  if (isWritable && !isSigner) {
    return AccountRole.WRITABLE;
  }
  if (!isWritable && isSigner) {
    return AccountRole.READONLY_SIGNER;
  }

  return AccountRole.READONLY;
}

export async function createLegacyTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  options?: { commitment?: Commitment },
): Promise<Transaction> {
  let transaction = new Transaction();

  transaction.instructions = instructions;
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash(options)
  ).blockhash;

  return transaction;
}
