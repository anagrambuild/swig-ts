/**
 * Transfer SVM SOL Destination Test
 *
 * Tests SOL destination limit constraints.
 * Mirrors: examples/classic/transfer/transfer-svm-sol-destination.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add role with SOL destination limit (can only send to specific recipient)
 * 3. Transfer to authorized recipient succeeds
 * 4. Transfer to unauthorized recipient fails
 */

import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

describe('transfer-svm-sol-destination', () => {
  test('allows transfer to authorized destination', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const authorizedRecipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.publicKey),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    // Fund wallet
    svm.airdrop(walletAddress, SOL * 2n);

    // Add spender with destination limit
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.publicKey),
      Actions.set()
        .solDestinationLimit({
          amount: SOL,
          destination: authorizedRecipient,
        })
        .get(),
    );
    sendSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Transfer to authorized recipient
    const transferAmount = SOL / 2n;
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: authorizedRecipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(swig, spenderRole.id, [transfer]);
    sendSVMTransaction(svm, signIx, spender);

    expect(svm.getBalance(authorizedRecipient)).toBe(transferAmount);
  });

  test('rejects transfer to unauthorized destination', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const authorizedRecipient = Keypair.generate().publicKey;
    const unauthorizedRecipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.publicKey),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    // Fund wallet
    svm.airdrop(walletAddress, SOL * 2n);

    // Add spender with destination limit to authorized recipient only
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.publicKey),
      Actions.set()
        .solDestinationLimit({
          amount: SOL,
          destination: authorizedRecipient,
        })
        .get(),
    );
    sendSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Try to transfer to unauthorized recipient
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: unauthorizedRecipient,
      lamports: Number(SOL / 2n),
    });

    const signIx = await getSignInstructions(swig, spenderRole.id, [transfer]);

    expect(() => sendSVMTransaction(svm, signIx, spender)).toThrow();
    expect(svm.getBalance(unauthorizedRecipient) ?? 0n).toBe(0n);
  });
});
