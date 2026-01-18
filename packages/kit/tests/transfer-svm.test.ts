/**
 * Transfer SVM Test (Kit)
 *
 * Tests Ed25519 authority transfers with SOL limits using kit-style instructions.
 * Uses the bridge pattern to convert kit instructions to web3.js for LiteSVM.
 *
 * Mirrors: examples/kit/transfer/transfer-local.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add authority manager with manageAuthority permission
 * 3. Add spender authority with SOL limit
 * 4. Transfer SOL within limit
 * 5. Verify transfer beyond limit fails
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

describe('transfer-svm', () => {
  test('creates swig with root authority and manages roles', async () => {
    const svm = getSvm();
    const [userRoot, authorityManager, dappAuthority] = getFundedKeys(svm, 3);
    const dappTreasury = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig with root (all) permissions
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(userRoot.address),
      id: swigId,
      payer: userRoot.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], userRoot);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);

    // Find root role
    const rootRoles = swig.findRolesByEd25519SignerPk(userRoot.publicKey);
    expect(rootRoles.length).toBe(1);
    const rootRole = rootRoles[0];
    expect(rootRole.actions.isRoot()).toBe(true);

    // Add authority manager with manageAuthority permission
    const managerActions = Actions.set().manageAuthority().get();
    const addManagerIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(authorityManager.address),
      managerActions,
    );
    sendKitTransaction(svm, addManagerIx, userRoot);

    swig = fetchSwig(svm, swigAddress);
    const managerRoles = swig.findRolesByEd25519SignerPk(
      authorityManager.publicKey,
    );
    expect(managerRoles.length).toBe(1);
    const managerRole = managerRoles[0];
    expect(managerRole.actions.canManageAuthority()).toBe(true);

    // Add dapp authority with 0.1 SOL limit
    const solLimit = SOL / 10n;
    const dappActions = Actions.set().solLimit({ amount: solLimit }).get();
    const addDappIx = await getAddAuthorityInstructions(
      swig,
      managerRole.id,
      createEd25519AuthorityInfo(dappAuthority.address),
      dappActions,
    );
    sendKitTransaction(svm, addDappIx, authorityManager);

    // Fund wallet
    svm.airdrop(addressToPublicKey(walletAddress), SOL);

    swig = fetchSwig(svm, swigAddress);

    // Verify roles
    expect(swig.roles.length).toBe(3);
    expect(swig.roles.map((r) => r.actions.canSpendSol())).toEqual([
      true,
      false,
      true,
    ]);
    expect(swig.roles.map((r) => r.actions.canSpendSol(solLimit))).toEqual([
      true,
      false,
      true,
    ]);

    // Find dapp role
    const dappRole = swig.findRolesByEd25519SignerPk(
      dappAuthority.publicKey,
    )[0];
    expect(dappRole).toBeDefined();

    const balanceBefore = svm.getBalance(addressToPublicKey(walletAddress))!;

    // Transfer max SOL permitted (0.1 SOL)
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: dappTreasury,
      lamports: Number(solLimit),
    });
    const signTransfer = await getSignInstructions(swig, dappRole.id, [
      web3InstructionToKit(transfer),
    ]);
    sendKitTransaction(svm, signTransfer, dappAuthority);

    const balanceAfter = svm.getBalance(addressToPublicKey(walletAddress))!;
    expect(balanceBefore - balanceAfter).toBe(solLimit);
    expect(svm.getBalance(dappTreasury)).toBe(solLimit);
  });

  test('rejects transfer exceeding SOL limit', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate().publicKey;
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

    // Add spender with 0.1 SOL limit
    const solLimit = SOL / 10n;
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set().solLimit({ amount: solLimit }).get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Try to transfer 0.2 SOL (exceeds 0.1 limit)
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(walletAddress),
      toPubkey: recipient,
      lamports: Number(SOL / 5n),
    });
    const signTransfer = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transfer),
    ]);

    expect(() => sendKitTransaction(svm, signTransfer, spender)).toThrow();
    expect(svm.getBalance(recipient) ?? 0n).toBe(0n);
  });
});
