/**
 * Transfer SVM SubAccount Test (Kit)
 *
 * Tests SubAccount authority transfers.
 * Mirrors: examples/kit/transfer/transfer-local-subaccount.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Add authority with subAccount permission
 * 3. Create subaccount
 * 4. Transfer SOL from subaccount
 */

import { Keypair, SystemProgram } from '@solana/web3.js';
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
import {
  addressToPublicKey,
  fetchSwig,
  getFundedKeys,
  getSvm,
  LAMPORTS_PER_SOL_BIGINT,
} from './context';
import { randomBytes, sendKitTransaction, web3InstructionToKit } from './utils';

const SOL = LAMPORTS_PER_SOL_BIGINT;

describe('transfer-svm-subaccount', () => {
  test('creates subaccount and transfers SOL from it', async () => {
    const svm = getSvm();
    const [rootAuthority, subAccountAuthority] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate().publicKey;
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig with root authority
    const createIx = await getCreateSwigInstruction({
      payer: rootAuthority.address,
      actions: Actions.set().all().get(),
      authorityInfo: createEd25519AuthorityInfo(rootAuthority.address),
      id: swigId,
    });
    sendKitTransaction(svm, [createIx], rootAuthority);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.roles[0];

    expect(swig.accountVersion()).toBe('v2');

    // Add subaccount authority
    const addAuthorityIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(subAccountAuthority.address),
      Actions.set().subAccount().get(),
    );
    sendKitTransaction(svm, addAuthorityIx, rootAuthority);

    swig = fetchSwig(svm, swigAddress);
    const subAccountAuthRole = swig.roles[1];
    expect(subAccountAuthRole).toBeDefined();

    // Create subaccount
    const createSubAccountIx = await getCreateSubAccountInstructions(
      swig,
      subAccountAuthRole.id,
    );
    sendKitTransaction(svm, createSubAccountIx, subAccountAuthority);

    swig = fetchSwig(svm, swigAddress);

    // Get subaccount address and fund it
    const subAccountAddress = await findSwigSubAccountPda(
      subAccountAuthRole.swigId,
      subAccountAuthRole.id,
    );
    svm.airdrop(addressToPublicKey(subAccountAddress), SOL);

    const subAccountBalance = svm.getBalance(
      addressToPublicKey(subAccountAddress),
    )!;
    expect(subAccountBalance >= SOL).toBe(true);

    // Transfer from subaccount
    const transferAmount = SOL / 10n;
    const transfer = SystemProgram.transfer({
      fromPubkey: addressToPublicKey(subAccountAddress),
      toPubkey: recipient,
      lamports: Number(transferAmount),
    });

    const signIx = await getSignInstructions(
      swig,
      subAccountAuthRole.id,
      [web3InstructionToKit(transfer)],
      true, // withSubAccount = true
    );
    sendKitTransaction(svm, signIx, subAccountAuthority);

    // Verify recipient received the transfer
    expect(svm.getBalance(recipient)).toBe(transferAmount);
    // Subaccount balance reduced (has rent-exempt minimum)
    expect(
      svm.getBalance(addressToPublicKey(subAccountAddress))! <
        subAccountBalance,
    ).toBe(true);
  });
});
