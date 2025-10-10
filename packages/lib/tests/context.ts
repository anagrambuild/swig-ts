import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
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
import { toPublicKey } from './utils';

export function getSvm() {
  let swigProgram = Uint8Array.from(
    readFileSync(join(__dirname, '../../../swig.so')),
  );
  let svm = new LiteSVM();
  svm.addProgram(new PublicKey(SWIG_PROGRAM_ADDRESS_STRING), swigProgram);
  return svm;
}

export function getFundedKeys(
  svm: LiteSVM,
  count = 5,
  amount = LAMPORTS_PER_SOL,
) {
  return Array.from({ length: count }, () => {
    let key = Keypair.generate();
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
