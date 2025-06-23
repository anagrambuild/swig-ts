import { getAddressCodec } from '@solana/kit';
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => {
    let passed = value === b[index];
    if (!passed)
      console.log('❌ not passed.', 'index:', index, 'value:', value);
    return passed;
  });
}

export function mockPublicKey(byte: number) {
  return new PublicKey(Uint8Array.from(Array(32).fill(byte)));
}

export function mockAddress(byte: number) {
  return getAddressCodec().decode(Uint8Array.from(Array(32).fill(byte)));
}

export function mockBytesArray(byte: number, length: number) {
  return Uint8Array.from(Array(length).fill(byte));
}

export function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [],
) {
  let transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer, ...signers);

  let tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx:', tx.meta().logs());
    throw new Error(tx.err().toString());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
  }
}

export function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}
