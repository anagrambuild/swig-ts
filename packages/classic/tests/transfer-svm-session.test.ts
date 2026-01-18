/**
 * Transfer SVM Session Test
 *
 * Tests Ed25519 session-based authority transfers.
 * Mirrors: examples/classic/transfer/transfer-svm-session.ts
 *
 * Flow:
 * 1. Create swig with Ed25519 session authority
 * 2. Create a session with session key
 * 3. Transfer SOL using session key
 */

import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  createEd25519SessionAuthorityInfo,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

describe('transfer-svm-session', () => {
  test('creates session and transfers SOL with session key', async () => {
    const svm = getSvm();
    const [root, sessionKey] = getFundedKeys(svm, 2);
    const treasury = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with session authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519SessionAuthorityInfo(root.publicKey, 100n),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    // Create session
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.publicKey,
      50n,
    );
    sendSVMTransaction(svm, sessionIx, root);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();
    expect(sessionRole!.authority.session).toBeDefined();

    // Transfer using session key
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: treasury,
      lamports: Number(transferAmount),
    });

    const signTransfer = await getSignInstructions(
      swig,
      sessionRole!.id,
      [transfer],
      false,
      { payer: sessionKey.publicKey },
    );
    sendSVMTransaction(svm, signTransfer, sessionKey);

    expect(svm.getBalance(treasury)).toBe(transferAmount);
    // Wallet balance reduced by transfer amount (rent exempt minimum may vary)
    expect(svm.getBalance(walletAddress)! < SOL).toBe(true);
  });
});
