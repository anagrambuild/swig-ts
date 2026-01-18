/**
 * Kit Test Context
 *
 * Provides LiteSVM testing infrastructure for the kit package.
 * Uses a bridge pattern to build kit-style instructions and convert
 * them to web3.js for LiteSVM execution.
 */

import { getAddressDecoder, type Address } from '@solana/kit';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import { LiteSVM } from 'litesvm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Swig, SWIG_PROGRAM_ADDRESS, type SwigFetchFn } from '../src';

/**
 * TestKeypair bridges kit Address with web3.js Keypair for LiteSVM testing.
 * Use .address for kit-style access, ._keypair for LiteSVM signing.
 */
export interface TestKeypair {
  /** The address as @solana/kit Address type */
  address: Address;
  /** The public key as web3.js PublicKey for LiteSVM */
  publicKey: PublicKey;
  /** Internal web3.js keypair for LiteSVM signing */
  _keypair: Keypair;
}

/**
 * Convert a kit Address to a web3.js PublicKey for LiteSVM.
 */
export function addressToPublicKey(addr: Address): PublicKey {
  return new PublicKey(addr);
}

/**
 * Convert a web3.js PublicKey to a kit Address.
 */
export function publicKeyToAddress(pubkey: PublicKey): Address {
  return getAddressDecoder().decode(pubkey.toBytes());
}

/**
 * Generate a test keypair that works with both kit types and LiteSVM.
 */
export function generateTestKeypair(): TestKeypair {
  const keypair = Keypair.generate();
  return {
    address: getAddressDecoder().decode(keypair.publicKey.toBytes()),
    publicKey: keypair.publicKey,
    _keypair: keypair,
  };
}

export const LAMPORTS_PER_SOL_BIGINT = BigInt(LAMPORTS_PER_SOL);

/**
 * Create a new LiteSVM instance with the Swig program loaded.
 */
export function getSvm(): LiteSVM {
  const swigProgram = Uint8Array.from(
    readFileSync(join(__dirname, '../../../swig.so')),
  );
  const svm = new LiteSVM();
  svm.addProgram(new PublicKey(SWIG_PROGRAM_ADDRESS), swigProgram);
  return svm;
}

/**
 * Generate funded test keypairs.
 */
export function getFundedKeys(
  svm: LiteSVM,
  count = 5,
  amount = LAMPORTS_PER_SOL_BIGINT,
): TestKeypair[] {
  return Array.from({ length: count }, () => {
    const key = generateTestKeypair();
    svm.airdrop(key.publicKey, amount);
    return key;
  });
}

/**
 * Decode Swig account data from raw bytes.
 */
function decodeSwigAccount(data: Uint8Array): SwigAccount {
  return getSwigCodec().decode(data);
}

/**
 * Create a SwigFetchFn for LiteSVM that fetches account data from the SVM.
 */
function createSvmSwigFetchFn(svm: LiteSVM): SwigFetchFn {
  return async (swigAddress) => {
    const addr =
      typeof swigAddress === 'string'
        ? swigAddress
        : getAddressDecoder().decode(
            new Uint8Array(swigAddress as unknown as ArrayLike<number>),
          );
    const account = svm.getAccount(addressToPublicKey(addr as Address));
    if (!account) throw new Error('Swig account not found');
    return decodeSwigAccount(Uint8Array.from(account.data));
  };
}

/**
 * Fetch a Swig account from LiteSVM and return as kit Swig type.
 */
export function fetchSwig(svm: LiteSVM, swigAddress: Address): Swig {
  const account = svm.getAccount(addressToPublicKey(swigAddress));
  if (!account) throw new Error('Swig account not found');
  const accountData = Uint8Array.from(account.data);
  const swigAccount = decodeSwigAccount(accountData);
  return new Swig(swigAddress, swigAccount, createSvmSwigFetchFn(svm));
}
