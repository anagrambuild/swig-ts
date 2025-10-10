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
import {
  SolPublicKey,
  SwigInstructionContext,
  type SolPublicKeyData,
  type Web3Instruction,
} from '../src';

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

export function sendSwigSVMTransaction(
  svm: LiteSVM,
  swigIxCtx: SwigInstructionContext,
  payer: Keypair,
  signers: Keypair[] = [],
) {
  return sendSVMTransaction(
    svm,
    getInstructionsFromContext(swigIxCtx),
    payer,
    signers,
  );
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

  // @ts-ignore
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

export function toPublicKey(solPublicKeyData: SolPublicKeyData): PublicKey {
  const publicKeyBytes = new SolPublicKey(solPublicKeyData).toBytes();
  return new PublicKey(publicKeyBytes);
}

export function getInstructionsFromContext(
  swigContext: SwigInstructionContext,
): TransactionInstruction[] {
  return swigContext
    .getWeb3Instructions()
    .map(getTransactionInstructionFromWeb3Instruction);
}

function getTransactionInstructionFromWeb3Instruction(
  ix: Web3Instruction,
): TransactionInstruction {
  return {
    programId: new PublicKey(ix.programId.toBytes()),
    keys: ix.keys.map((meta) => ({
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
      pubkey: new PublicKey(meta.pubkey.toBytes()),
    })),
    data: Buffer.from(ix.data),
  };
}
