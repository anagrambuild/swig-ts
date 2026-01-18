/**
 * Transfer SVM Secp256k1 Test
 *
 * Tests Secp256k1 (Ethereum wallet) authority transfers.
 * Mirrors: examples/classic/transfer/transfer-svm-secp.ts
 *
 * Flow:
 * 1. Create swig with Secp256k1 authority (Ethereum wallet)
 * 2. Transfer SOL using Ethereum wallet signature
 */

import { Wallet } from '@ethereumjs/wallet';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
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

describe('transfer-svm-secp', () => {
  test('transfers SOL with Ethereum wallet (Secp256k1)', async () => {
    const svm = getSvm();
    const [payer] = getFundedKeys(svm, 1);
    const wallet = Wallet.generate();
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256k1 authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(wallet.getPublicKey()),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], payer);

    const swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const role = swig.findRolesBySecp256k1SignerAddress(wallet.getAddress())[0];

    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      wallet.getPrivateKey(),
    );

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
