/**
 * Transfer SVM Secp256k1 Bitcoin Keypair Test
 *
 * Tests Secp256k1 (Bitcoin keypair) authority transfers using real Bitcoin
 * wallet libraries (bitcoinjs-lib, ecpair, tiny-secp256k1) alongside the
 * raw @noble/curves approach.
 *
 * Demonstrates that a Bitcoin keypair generated with standard Bitcoin tooling
 * can serve as the authority on a swig wallet, with a separate Solana
 * "paymaster" keypair covering transaction fees.
 *
 * Flow:
 * 1. Generate a Bitcoin keypair using bitcoinjs-lib / ecpair
 * 2. Create swig with Secp256k1 authority using the Bitcoin public key
 * 3. Derive the Bitcoin address (P2WPKH / P2PKH) for display purposes
 * 4. Use a funded Solana "paymaster" keypair to pay transaction fees
 * 5. Transfer SOL using the Bitcoin private key signature + paymaster fee payment
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { describe, expect, test } from 'bun:test';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import {
  Actions,
  compressedPubkeyToAddress,
  createSecp256k1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

// Initialize bitcoinjs-lib with the secp256k1 implementation
bitcoin.initEccLib(tinysecp);

// Create the ECPair factory from the bitcoinjs ecosystem
const ECPair = ECPairFactory(tinysecp);

describe('transfer-svm-secp-bitcoin', () => {
  test('transfers SOL with bitcoinjs-lib keypair and paymaster', async () => {
    const svm = getSvm();

    // Paymaster: a funded Solana keypair that pays transaction fees
    const [paymaster] = getFundedKeys(svm, 1);

    // Generate a Bitcoin keypair using ecpair (standard bitcoinjs-lib tooling)
    const btcKeyPair = ECPair.makeRandom({ compressed: true });

    // The raw key bytes from the Bitcoin keypair
    const btcPrivateKey = btcKeyPair.privateKey!; // Uint8Array (32 bytes)
    const btcPublicKey = btcKeyPair.publicKey; // Uint8Array (33 bytes, compressed)

    // Derive the Bitcoin addresses for reference (proves this is a real BTC key)
    const { address: p2wpkhAddress } = bitcoin.payments.p2wpkh({
      pubkey: btcPublicKey,
    });
    const { address: p2pkhAddress } = bitcoin.payments.p2pkh({
      pubkey: btcPublicKey,
    });
    expect(p2wpkhAddress).toStartWith('bc1q'); // native segwit
    expect(p2pkhAddress).toStartWith('1'); // legacy

    // Derive the 20-byte keccak address used by the swig program for secp256k1
    const signerAddress = compressedPubkeyToAddress(btcPublicKey);

    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256k1 authority using the Bitcoin compressed public key
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(btcPublicKey),
      id: swigId,
      payer: paymaster.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], paymaster);

    const swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);

    // Look up the role using the keccak-derived address
    const role = swig.findRolesBySecp256k1SignerAddress(signerAddress)[0];
    expect(role).toBeDefined();

    // Fund the swig wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(btcPrivateKey);

    // Transfer SOL: Bitcoin keypair authorizes, paymaster pays Solana fees
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(swig, role.id, [transfer], false, {
      payer: paymaster.publicKey,
      currentSlot: slot,
      signingFn,
    });
    sendSVMTransaction(svm, signIx, paymaster);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });

  test('transfers SOL with Bitcoin WIF-imported keypair and paymaster', async () => {
    const svm = getSvm();

    // Paymaster: a funded Solana keypair that pays transaction fees
    const [paymaster] = getFundedKeys(svm, 1);

    // Generate a Bitcoin keypair and export its WIF (Wallet Import Format)
    const originalKeyPair = ECPair.makeRandom({ compressed: true });
    const wif = originalKeyPair.toWIF();

    // Re-import from WIF — simulates importing an existing Bitcoin wallet
    const btcKeyPair = ECPair.fromWIF(wif);

    const btcPrivateKey = btcKeyPair.privateKey!;
    const btcPublicKey = btcKeyPair.publicKey;

    // Verify the re-imported key produces a valid Bitcoin address
    const { address: btcAddress } = bitcoin.payments.p2wpkh({
      pubkey: btcPublicKey,
    });
    expect(btcAddress).toStartWith('bc1q');

    const signerAddress = compressedPubkeyToAddress(btcPublicKey);

    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with the WIF-imported Bitcoin key as authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(btcPublicKey),
      id: swigId,
      payer: paymaster.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], paymaster);

    const swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);

    const role = swig.findRolesBySecp256k1SignerAddress(signerAddress)[0];
    expect(role).toBeDefined();

    // Fund the swig wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(btcPrivateKey);

    // Transfer SOL using the WIF-imported Bitcoin key
    const transferAmount = SOL / 5n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(swig, role.id, [transfer], false, {
      payer: paymaster.publicKey,
      currentSlot: slot,
      signingFn,
    });
    sendSVMTransaction(svm, signIx, paymaster);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });

  test('transfers SOL with raw @noble/curves secp256k1 keypair and paymaster', async () => {
    const svm = getSvm();

    // Paymaster: a funded Solana keypair that pays transaction fees
    const [paymaster] = getFundedKeys(svm, 1);

    // Generate a secp256k1 keypair using @noble/curves directly
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKeyCompressed = secp256k1.getPublicKey(privateKey, true);

    const signerAddress = compressedPubkeyToAddress(publicKeyCompressed);

    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig using the compressed public key
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(publicKeyCompressed),
      id: swigId,
      payer: paymaster.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], paymaster);

    const swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);

    const role = swig.findRolesBySecp256k1SignerAddress(signerAddress)[0];
    expect(role).toBeDefined();

    // Fund the swig wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(privateKey);

    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(swig, role.id, [transfer], false, {
      payer: paymaster.publicKey,
      currentSlot: slot,
      signingFn,
    });
    sendSVMTransaction(svm, signIx, paymaster);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });
});
