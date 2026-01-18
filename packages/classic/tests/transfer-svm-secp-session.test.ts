/**
 * Transfer SVM Secp256k1 Session Test
 *
 * Tests Secp256k1 session-based authority transfers.
 * Mirrors: examples/classic/transfer/transfer-svm-secp-session.ts
 *
 * Flow:
 * 1. Create swig with Secp256k1 session authority
 * 2. Create session with session key
 * 3. Transfer SOL using session key (no Ethereum signature needed)
 */

import { Wallet } from '@ethereumjs/wallet';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  createSecp256k1SessionAuthorityInfo,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

describe('transfer-svm-secp-session', () => {
  test('creates session and transfers SOL with session key', async () => {
    const svm = getSvm();
    const [payer, sessionKey] = getFundedKeys(svm, 2);
    const wallet = Wallet.generate();
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256k1 session authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1SessionAuthorityInfo(
        wallet.getPublicKey(),
        100n,
      ),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      wallet.getPrivateKey(),
    );

    // Create session (requires Ethereum signature)
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.publicKey,
      50n,
      { currentSlot: slot, signingFn, payer: payer.publicKey },
    );
    sendSVMTransaction(svm, sessionIx, payer);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();

    // Transfer using session key (no signingFn needed - session key signs)
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(
      swig,
      sessionRole!.id,
      [transfer],
      false,
      { payer: sessionKey.publicKey },
    );
    sendSVMTransaction(svm, signIx, sessionKey);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });
});
