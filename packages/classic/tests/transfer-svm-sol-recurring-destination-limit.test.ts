/**
 * Transfer SVM SOL Recurring Destination Limit Test
 *
 * Tests SOL recurring destination limit constraints.
 * Mirrors: examples/classic/transfer/transfer-svm-sol-recurring-destination-limit.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add role with solRecurringDestinationLimit
 * 3. Test transfers within and exceeding the limit
 * 4. Test transfer to unauthorized destination fails
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

describe('transfer-svm-sol-recurring-destination-limit', () => {
  test('allows transfers within recurring limit to authorized destination', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with root authority
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.publicKey),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.findRoleById(0)!;
    const walletAddress = await getSwigWalletAddress(swig);

    // Fund wallet
    svm.airdrop(walletAddress, SOL * 5n);

    // Add spender with recurring destination limit: 0.5 SOL per window
    const recurringAmount = SOL / 2n; // 0.5 SOL
    const window = 100n; // 100 slots

    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.publicKey),
      Actions.set()
        .solRecurringDestinationLimit({
          recurringAmount,
          window,
          destination: recipient,
        })
        .get(),
    );
    sendSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
    expect(spenderRole).toBeDefined();

    // First transfer: 0.3 SOL (within limit)
    const transferAmount1 = (SOL * 3n) / 10n; // 0.3 SOL
    const transfer1 = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount1),
    });

    const signIx1 = await getSignInstructions(swig, spenderRole.id, [
      transfer1,
    ]);
    sendSVMTransaction(svm, signIx1, spender);

    expect(svm.getBalance(recipient)).toBe(transferAmount1);

    // Second transfer: 0.2 SOL (total 0.5 SOL, exactly at limit)
    swig = fetchSwig(svm, swigAddress);
    const transferAmount2 = (SOL * 2n) / 10n; // 0.2 SOL
    const transfer2 = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount2),
    });

    const signIx2 = await getSignInstructions(swig, spenderRole.id, [
      transfer2,
    ]);
    sendSVMTransaction(svm, signIx2, spender);

    expect(svm.getBalance(recipient)).toBe(transferAmount1 + transferAmount2);
  });

  test('rejects transfer exceeding recurring limit', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate().publicKey;
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
    const rootRole = swig.findRoleById(0)!;
    const walletAddress = await getSwigWalletAddress(swig);

    svm.airdrop(walletAddress, SOL * 5n);

    // Add spender with 0.5 SOL recurring limit
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.publicKey),
      Actions.set()
        .solRecurringDestinationLimit({
          recurringAmount: SOL / 2n,
          window: 100n,
          destination: recipient,
        })
        .get(),
    );
    sendSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // First transfer uses up the limit
    const transfer1 = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(SOL / 2n),
    });
    const signIx1 = await getSignInstructions(swig, spenderRole.id, [
      transfer1,
    ]);
    sendSVMTransaction(svm, signIx1, spender);

    // Third transfer should fail (exceeds limit)
    swig = fetchSwig(svm, swigAddress);
    const transfer3 = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(SOL / 10n), // 0.1 SOL over limit
    });
    const signIx3 = await getSignInstructions(swig, spenderRole.id, [
      transfer3,
    ]);

    expect(() => sendSVMTransaction(svm, signIx3, spender)).toThrow();
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
    const rootRole = swig.findRoleById(0)!;
    const walletAddress = await getSwigWalletAddress(swig);

    svm.airdrop(walletAddress, SOL * 5n);

    // Add spender with limit to authorized recipient only
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.publicKey),
      Actions.set()
        .solRecurringDestinationLimit({
          recurringAmount: SOL,
          window: 100n,
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
      lamports: Number(SOL / 10n),
    });
    const signIx = await getSignInstructions(swig, spenderRole.id, [transfer]);

    expect(() => sendSVMTransaction(svm, signIx, spender)).toThrow();
    expect(svm.getBalance(unauthorizedRecipient) ?? 0n).toBe(0n);
  });
});
