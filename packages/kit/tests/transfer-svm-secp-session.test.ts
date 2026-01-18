/**
 * Transfer SVM Secp256k1 Session Test (Kit)
 *
 * Tests Secp256k1 session-based authority transfers.
 * Mirrors: examples/kit/transfer/transfer-local-session-secp256k1.ts
 *
 * Flow:
 * 1. Create swig with Secp256k1 session authority
 * 2. Create session with session key (requires Ethereum signature)
 * 3. Transfer SOL using session key (no Ethereum signature needed)
 */

import { Wallet } from '@ethereumjs/wallet';
import { Keypair, SystemProgram } from '@solana/web3.js';
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
import {
  addressToPublicKey,
  fetchSwig,
  getFundedKeys,
  getSvm,
  LAMPORTS_PER_SOL_BIGINT,
} from './context';
import { randomBytes, sendKitTransaction, web3InstructionToKit } from './utils';

const SOL = LAMPORTS_PER_SOL_BIGINT;

describe('transfer-svm-secp-session', () => {
  test('creates session and transfers SOL with session key', async () => {
    const svm = getSvm();
    const [payer, sessionKey] = getFundedKeys(svm, 2);
    const wallet = Wallet.generate();
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig with secp256k1 session authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1SessionAuthorityInfo(
        wallet.getPublicKey(),
        100n,
      ),
      id: swigId,
      payer: payer.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(addressToPublicKey(walletAddress), SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      wallet.getPrivateKey(),
    );

    // Create session (requires Ethereum signature)
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.address,
      50n,
      { currentSlot: slot, signingFn, payer: payer.address },
    );
    sendKitTransaction(svm, sessionIx, payer);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();

    // Transfer using session key (no signingFn needed - session key signs)
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(
      swig,
      sessionRole!.id,
      [web3InstructionToKit(transfer)],
      false,
      { payer: sessionKey.address },
    );
    sendKitTransaction(svm, signIx, sessionKey);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });
});
