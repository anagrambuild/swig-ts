/**
 * Transfer SVM Session Test (Kit)
 *
 * Tests Ed25519 session-based authority transfers.
 * Mirrors: examples/kit/transfer/transfer-local-session.ts
 *
 * Flow:
 * 1. Create swig with Ed25519 session authority
 * 2. Create a session with session key
 * 3. Transfer SOL using session key
 */

import { Keypair, SystemProgram } from '@solana/web3.js';
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
import {
  addressToPublicKey,
  fetchSwig,
  getFundedKeys,
  getSvm,
  LAMPORTS_PER_SOL_BIGINT,
} from './context';
import { randomBytes, sendKitTransaction, web3InstructionToKit } from './utils';

const SOL = LAMPORTS_PER_SOL_BIGINT;

describe('transfer-svm-session', () => {
  test('creates session and transfers SOL with session key', async () => {
    const svm = getSvm();
    const [root, sessionKey] = getFundedKeys(svm, 2);
    const treasury = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig with session authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519SessionAuthorityInfo(root.address, 100n),
      id: swigId,
      payer: root.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(addressToPublicKey(walletAddress), SOL);

    // Create session
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.address,
      50n,
    );
    sendKitTransaction(svm, sessionIx, root);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();
    expect(sessionRole!.authority.session).toBeDefined();

    // Transfer using session key
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: treasury,
      lamports: Number(transferAmount),
    });

    const signTransfer = await getSignInstructions(
      swig,
      sessionRole!.id,
      [web3InstructionToKit(transfer)],
      false,
      { payer: sessionKey.address },
    );
    sendKitTransaction(svm, signTransfer, sessionKey);

    expect(svm.getBalance(treasury)).toBe(transferAmount);
    // Wallet balance reduced (rent exempt minimum may vary)
    expect(svm.getBalance(addressToPublicKey(walletAddress))! < SOL).toBe(true);
  });
});
