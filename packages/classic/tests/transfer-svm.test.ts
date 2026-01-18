/**
 * Transfer SVM Test
 *
 * Tests Ed25519 authority transfers with SOL limits.
 * Mirrors: examples/classic/transfer/transfer-svm.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add authority manager with manageAuthority permission
 * 3. Add dapp authority with SOL limit
 * 4. Transfer SOL within limit
 * 5. Verify transfer beyond limit fails
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

describe('transfer-svm', () => {
  test('creates swig with root authority and manages roles', async () => {
    const svm = getSvm();
    const [userRoot, authorityManager, dappAuthority] = getFundedKeys(svm, 3);
    const dappTreasury = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with root (all) permissions
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(userRoot.publicKey),
      id: swigId,
      payer: userRoot.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], userRoot);

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
      createEd25519AuthorityInfo(authorityManager.publicKey),
      managerActions,
    );
    sendSVMTransaction(svm, addManagerIx, userRoot);

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
      createEd25519AuthorityInfo(dappAuthority.publicKey),
      dappActions,
    );
    sendSVMTransaction(svm, addDappIx, authorityManager);

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

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
    expect(swig.roles.map((r) => r.actions.canSpendSol(solLimit + 1n))).toEqual(
      [true, false, false],
    );

    // Find dapp role
    const dappRole = swig.findRolesByEd25519SignerPk(
      dappAuthority.publicKey,
    )[0];
    expect(dappRole).toBeDefined();
    expect(
      dappRole.authority.matchesSigner(dappAuthority.publicKey.toBytes()),
    ).toBe(true);

    const balanceBefore = svm.getBalance(walletAddress)!;

    // Transfer max SOL permitted (0.1 SOL)
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: dappTreasury,
      lamports: Number(solLimit),
    });
    const signTransfer = await getSignInstructions(swig, dappRole.id, [
      transfer,
    ]);
    sendSVMTransaction(svm, signTransfer, dappAuthority);

    const balanceAfter = svm.getBalance(walletAddress)!;
    expect(balanceBefore - balanceAfter).toBe(solLimit);
    expect(svm.getBalance(dappTreasury)).toBe(solLimit);
  });

  test('rejects transfer exceeding SOL limit', async () => {
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
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;

    // Fund wallet
    svm.airdrop(walletAddress, SOL * 2n);

    // Add spender with 0.1 SOL limit
    const solLimit = SOL / 10n;
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.publicKey),
      Actions.set().solLimit({ amount: solLimit }).get(),
    );
    sendSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Try to transfer 0.2 SOL (exceeds 0.1 limit)
    const transfer = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: recipient,
      lamports: Number(SOL / 5n),
    });
    const signTransfer = await getSignInstructions(swig, spenderRole.id, [
      transfer,
    ]);

    expect(() => sendSVMTransaction(svm, signTransfer, spender)).toThrow();
    expect(svm.getBalance(recipient) ?? 0n).toBe(0n);
  });
});
