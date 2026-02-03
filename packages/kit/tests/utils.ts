/**
 * Kit Test Utilities
 *
 * Provides helpers for converting kit-style instructions to web3.js
 * TransactionInstructions for LiteSVM execution.
 */

import { AccountRole, type Address, type Instruction } from '@solana/kit';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import type { KitInstruction } from '@swig-wallet/lib';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import type { TestKeypair } from './context';

/**
 * Convert a web3.js TransactionInstruction to a kit KitInstruction.
 */
export function web3InstructionToKit(
  ix: TransactionInstruction,
): KitInstruction {
  return {
    programAddress: ix.programId.toBase58() as Address,
    accounts: ix.keys.map((key) => ({
      address: key.pubkey.toBase58() as Address,
      role: getAccountRole(key.isSigner, key.isWritable),
    })),
    data: new Uint8Array(ix.data),
  };
}

/**
 * Get the AccountRole for a given signer/writable combination.
 */
function getAccountRole(isSigner: boolean, isWritable: boolean): AccountRole {
  if (isSigner && isWritable) return AccountRole.WRITABLE_SIGNER;
  if (isSigner) return AccountRole.READONLY_SIGNER;
  if (isWritable) return AccountRole.WRITABLE;
  return AccountRole.READONLY;
}

/**
 * Convert a kit Instruction to a web3.js TransactionInstruction.
 */
export function kitInstructionToWeb3(ix: Instruction): TransactionInstruction {
  // AccountRole enum: READONLY=0, WRITABLE=1, READONLY_SIGNER=2, WRITABLE_SIGNER=3
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((acct) => ({
      pubkey: new PublicKey(acct.address),
      isSigner: acct.role === 3 || acct.role === 2, // WRITABLE_SIGNER or READONLY_SIGNER
      isWritable: acct.role === 3 || acct.role === 1, // WRITABLE_SIGNER or WRITABLE
    })),
    data: Buffer.from(ix.data ?? []),
  });
}

/**
 * Convert an array of kit Instructions to web3.js TransactionInstructions.
 */
export function kitInstructionsToWeb3(
  ixs: Instruction[],
): TransactionInstruction[] {
  return ixs.map(kitInstructionToWeb3);
}

/**
 * Send a transaction with kit-style instructions to LiteSVM.
 * Converts kit instructions to web3.js format for execution.
 */
export function sendKitTransaction(
  svm: LiteSVM,
  instructions: Instruction[],
  payer: TestKeypair,
  signers: TestKeypair[] = [],
) {
  const web3Instructions = kitInstructionsToWeb3(instructions);
  return sendSVMTransaction(svm, web3Instructions, payer, signers);
}

/**
 * Send a web3.js transaction to LiteSVM.
 */
export function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: TestKeypair,
  signers: TestKeypair[] = [],
) {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer._keypair, ...signers.map((s) => s._keypair));

  const tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx:', tx.meta().logs());
    throw new Error(tx.err().toString());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
  }
}

/**
 * Generate random bytes.
 */
export function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

/**
 * Generate a random Address.
 */
export function randomAddress(): Address {
  const bytes = randomBytes(32);
  // Create a fake address from random bytes
  return new PublicKey(bytes).toBase58() as Address;
}
