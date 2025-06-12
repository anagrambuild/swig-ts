import { Keypair, LAMPORTS_PER_SOL, type PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Swig, SWIG_PROGRAM_ADDRESS } from '../src';

export function getSvm() {
  let swigProgram = Uint8Array.from(
    readFileSync(join(__dirname, '../../../swig.so')),
  );
  let svm = new LiteSVM();
  svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);
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

export function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  let swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  // Ensure we have a proper Uint8Array for the account data
  const accountData = Uint8Array.from(swigAccount.data);
  return Swig.fromRawAccountData(swigAddress, accountData);
}
