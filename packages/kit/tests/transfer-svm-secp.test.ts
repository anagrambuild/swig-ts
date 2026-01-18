/**
 * Transfer SVM Secp256k1 Test (Kit)
 *
 * Tests Secp256k1 (Ethereum wallet) authority transfers.
 * Mirrors: examples/kit/transfer/transfer-local-secp.ts
 *
 * Flow:
 * 1. Create swig with Secp256k1 authority (Ethereum wallet)
 * 2. Transfer SOL using Ethereum wallet signature
 */

import { Wallet } from '@ethereumjs/wallet';
import { Keypair, SystemProgram } from '@solana/web3.js';
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
import {
  addressToPublicKey,
  fetchSwig,
  getFundedKeys,
  getSvm,
  LAMPORTS_PER_SOL_BIGINT,
} from './context';
import { randomBytes, sendKitTransaction, web3InstructionToKit } from './utils';

const SOL = LAMPORTS_PER_SOL_BIGINT;

describe('transfer-svm-secp', () => {
  test('transfers SOL with Ethereum wallet (Secp256k1)', async () => {
    const svm = getSvm();
    const [payer] = getFundedKeys(svm, 1);
    const wallet = Wallet.generate();
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig with secp256k1 authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(wallet.getPublicKey()),
      id: swigId,
      payer: payer.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], payer);

    const swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const role = swig.findRolesBySecp256k1SignerAddress(wallet.getAddress())[0];

    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(addressToPublicKey(walletAddress), SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      wallet.getPrivateKey(),
    );

    // Transfer SOL
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(
      swig,
      role.id,
      [web3InstructionToKit(transfer)],
      false,
      {
        payer: payer.address,
        currentSlot: slot,
        signingFn,
      },
    );
    sendKitTransaction(svm, signIx, payer);

    expect(svm.getBalance(recipient)).toBe(transferAmount);
  });
});
