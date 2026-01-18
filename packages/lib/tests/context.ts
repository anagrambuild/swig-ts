import { PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getSwigCodec,
  Swig,
  SWIG_PROGRAM_ADDRESS_STRING,
  type SolPublicKeyData,
  type SwigAccount,
  type SwigFetchFn,
} from '../src';
import { generateTestKeypair, toPublicKey, type TestKeypair } from './helpers';

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function getSvm() {
  const swigProgram = Uint8Array.from(
    readFileSync(join(__dirname, '../../../swig.so')),
  );
  const svm = new LiteSVM();
  svm.addProgram(new PublicKey(SWIG_PROGRAM_ADDRESS_STRING), swigProgram);
  return svm;
}

export function getFundedKeys(
  svm: LiteSVM,
  count = 5,
  amount = LAMPORTS_PER_SOL,
): TestKeypair[] {
  return Array.from({ length: count }, () => {
    const key = generateTestKeypair();
    svm.airdrop(key.publicKey, BigInt(amount));
    return key;
  });
}

function fetchSwigAccount(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): SwigAccount {
  const swigAccount = svm.getAccount(swigAccountAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return getSwigCodec().decode(Uint8Array.from(swigAccount.data));
}

export function fetchSwig(
  svm: LiteSVM,
  swigAccountAddress: SolPublicKeyData,
): Swig {
  const account = fetchSwigAccount(svm, toPublicKey(swigAccountAddress));
  const swigFetchFn: SwigFetchFn = async (addr) =>
    fetchSwigAccount(svm, toPublicKey(addr));
  return new Swig(swigAccountAddress, account, swigFetchFn);
}
