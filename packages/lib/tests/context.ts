import { PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import { existsSync, readFileSync } from 'node:fs';
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

// Test program authority constants (for ProgramExec testing)
export const TEST_PROGRAM_ID = 'BXAu5ZWHnGun2XZjUZ9nqwiZ5dNVmofPGYdMC4rx4qLV';
export const VALID_DISCRIMINATOR = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

export function getSvm() {
  const swigProgram = Uint8Array.from(
    readFileSync(join(__dirname, '../../../swig.so')),
  );
  const svm = new LiteSVM();
  svm.addProgram(new PublicKey(SWIG_PROGRAM_ADDRESS_STRING), swigProgram);
  return svm;
}

export function getSvmWithTestProgram() {
  const svm = getSvm();
  const testProgramPath = join(__dirname, '../../../test_program_authority.so');
  if (existsSync(testProgramPath)) {
    const testProgram = Uint8Array.from(readFileSync(testProgramPath));
    svm.addProgram(new PublicKey(TEST_PROGRAM_ID), testProgram);
  }
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
