/**
 * Transfer SVM SOL Destination Test (Kit)
 *
 * Tests SOL destination limit constraints.
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add role with SOL destination limit (can only send to specific recipient)
 * 3. Transfer to authorized recipient succeeds
 * 4. Transfer to unauthorized recipient fails
 */

import { Keypair, SystemProgram } from '@solana/web3.js';
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
import {
  addressToPublicKey,
  fetchSwig,
  getFundedKeys,
  getSvm,
  LAMPORTS_PER_SOL_BIGINT,
} from './context';
import { randomBytes, sendKitTransaction, web3InstructionToKit } from './utils';

const SOL = LAMPORTS_PER_SOL_BIGINT;

describe('transfer-svm-sol-destination', () => {
  test('allows transfer to authorized destination', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const authorizedRecipient = Keypair.generate();
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.address),
      id: swigId,
      payer: root.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    // Fund wallet
    svm.airdrop(addressToPublicKey(walletAddress), SOL * 2n);

    // Add spender with destination limit
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set()
        .solDestinationLimit({
          amount: SOL,
          destination: authorizedRecipient.publicKey,
        })
        .get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Transfer to authorized recipient
    const transferAmount = SOL / 2n;
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: authorizedRecipient.publicKey,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transfer),
    ]);
    sendKitTransaction(svm, signIx, spender);

    expect(svm.getBalance(authorizedRecipient.publicKey)).toBe(transferAmount);
  });

  test('rejects transfer to unauthorized destination', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const authorizedRecipient = Keypair.generate();
    const unauthorizedRecipient = Keypair.generate();
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.address),
      id: swigId,
      payer: root.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    // Fund wallet
    svm.airdrop(addressToPublicKey(walletAddress), SOL * 2n);

    // Add spender with destination limit to authorized recipient only
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set()
        .solDestinationLimit({
          amount: SOL,
          destination: authorizedRecipient.publicKey,
        })
        .get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Try to transfer to unauthorized recipient
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: unauthorizedRecipient.publicKey,
      lamports: Number(SOL / 2n),
    });

    const signIx = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transfer),
    ]);

    expect(() => sendKitTransaction(svm, signIx, spender)).toThrow();
    expect(svm.getBalance(unauthorizedRecipient.publicKey) ?? 0n).toBe(0n);
  });
});
