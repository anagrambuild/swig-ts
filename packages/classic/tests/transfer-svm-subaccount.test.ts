/**
 * Transfer SVM SubAccount Test
 *
 * Tests SubAccount authority transfers.
 * Mirrors: examples/classic/transfer/transfer-svm-subaccount.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add authority with subAccount permission
 * 3. Create subaccount
 * 4. Transfer SOL from subaccount
 */

import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

describe('transfer-svm-subaccount', () => {
  test('creates subaccount and transfers SOL from it', async () => {
    const svm = getSvm();
    const [rootAuthority, subAccountAuthority] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with root authority
    const createIx = await getCreateSwigInstruction({
      payer: rootAuthority.publicKey,
      actions: Actions.set().all().get(),
      authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
      id: swigId,
    });
    sendSVMTransaction(svm, [createIx], rootAuthority);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.roles[0];

    expect(swig.accountVersion()).toBe('v2');

    // Add subaccount authority
    const addAuthorityIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(subAccountAuthority.publicKey),
      Actions.set().subAccount().get(),
    );
    sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

    swig = fetchSwig(svm, swigAddress);
    const subAccountAuthRole = swig.roles[1];
    expect(subAccountAuthRole).toBeDefined();

    // Create subaccount
    const createSubAccountIx = await getCreateSubAccountInstructions(
      swig,
      subAccountAuthRole.id,
    );
    sendSVMTransaction(svm, createSubAccountIx, subAccountAuthority);

    swig = fetchSwig(svm, swigAddress);

    // Get subaccount address and fund it
    const subAccountAddress = findSwigSubAccountPda(
      subAccountAuthRole.swigId,
      subAccountAuthRole.id,
    );
    svm.airdrop(subAccountAddress, SOL);

    const subAccountBalance = svm.getBalance(subAccountAddress)!;
    expect(subAccountBalance >= SOL).toBe(true);

    // Transfer from subaccount
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: subAccountAddress,
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(
      swig,
      subAccountAuthRole.id,
      [transfer],
      true, // withSubAccount = true
    );
    sendSVMTransaction(svm, signIx, subAccountAuthority);

    // Verify recipient received the transfer
    expect(svm.getBalance(recipient)).toBe(transferAmount);
    // Subaccount balance reduced (has rent-exempt minimum)
    expect(svm.getBalance(subAccountAddress)! < subAccountBalance).toBe(true);
  });
});
