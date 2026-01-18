/**
 * Transfer SVM Secp256r1 Test
 *
 * Tests Secp256r1 (P256/WebAuthn) authority transfers.
 * Mirrors: examples/classic/transfer/transfer-svm-r1.ts
 *
 * Flow:
 * 1. Create swig with Secp256r1 authority (P256 keypair)
 * 2. Transfer SOL using P256 signature
 */

import { p256 } from '@noble/curves/nist';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  createSecp256r1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256r1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

describe('transfer-svm-r1', () => {
  test('transfers SOL with Secp256r1 (P256) authority', async () => {
    const svm = getSvm();
    const [payer] = getFundedKeys(svm, 1);
    const r1 = p256.utils.randomPrivateKey();
    const r1PublicKey = p256.getPublicKey(r1);
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256r1 authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256r1AuthorityInfo(r1PublicKey),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);

    // Find role by compressed public key
    const r1CompressedPub = p256.getPublicKey(r1, true);
    const r1Roles = swig.findRolesByAuthoritySigner(r1CompressedPub);
    expect(r1Roles.length).toBeGreaterThan(0);
    const role = r1Roles[0];

    // Fund wallet
    svm.airdrop(walletAddress, SOL);
    swig = fetchSwig(svm, swigAddress);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256r1PrivateKey(r1);

    // Transfer SOL
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(swig, role.id, [transfer], false, {
      payer: payer.publicKey,
      currentSlot: slot,
      signingFn,
    });
    sendSVMTransaction(svm, signIx, payer);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });
});
