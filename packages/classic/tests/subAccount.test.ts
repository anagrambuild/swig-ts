import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { describe, test } from 'bun:test';
import assert from 'node:assert';
import {
  Actions,
  addAuthorityInstruction,
  createEd25519AuthorityInfo,
  createSubAccountInstruction,
  findSwigPda,
  findSwigSubAccountPda,
  signInstruction,
  Swig,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

describe('SubAccount Test', () => {
  const swigId = randomBytes(32);
  const [swigAddress] = findSwigPda(swigId);

  test('SubAccount', async () => {
    const svm = getSvm();
    const [rootAuthority, subAccountAuthority] = getFundedKeys(svm);

    // create a swig
    const createSwigIx = Swig.create({
      payer: rootAuthority.publicKey,
      actions: Actions.set().all().get(),
      authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
      id: swigId,
    });
    sendSVMTransaction(svm, createSwigIx, rootAuthority);

    let swig = fetchSwig(svm, swigAddress);

    let rootRole = swig.roles[0];

    // add a sub account authority
    const addAuthorityIx = await addAuthorityInstruction(
      rootRole,
      rootAuthority.publicKey,
      createEd25519AuthorityInfo(subAccountAuthority.publicKey),
      Actions.set().subAccount().get(),
    );
    sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

    swig = fetchSwig(svm, swigAddress);

    let subAccountAuthRole = swig.roles[1];

    // create sub account
    const createSubAccountIx = await createSubAccountInstruction(
      subAccountAuthRole,
      subAccountAuthority.publicKey,
    );
    sendSVMTransaction(svm, createSubAccountIx, subAccountAuthority);

    swig = fetchSwig(svm, swigAddress);

    rootRole = swig.roles[0];
    subAccountAuthRole = swig.roles[1];

    const subAccountAddress = findSwigSubAccountPda(
      subAccountAuthRole.swigId,
      subAccountAuthRole.id,
    )[0];

    svm.airdrop(subAccountAddress, BigInt(LAMPORTS_PER_SOL));

    const subBalance = svm.getBalance(subAccountAddress)!;

    const recipient = Keypair.generate().publicKey;

    const transfer = SystemProgram.transfer({
      fromPubkey: subAccountAddress,
      toPubkey: recipient,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    });

    const signIx = await signInstruction(
      subAccountAuthRole,
      subAccountAuthority.publicKey,
      [transfer],
      undefined,
      true,
    );
    sendSVMTransaction(svm, signIx, subAccountAuthority);

    const newSubBalance = svm.getBalance(subAccountAddress)!;
    const recipientBalance = svm.getBalance(recipient)!;

    assert(
      Number(subBalance) - 0.1 * LAMPORTS_PER_SOL === Number(newSubBalance),
      "sub account balance don't match after transfer",
    );

    assert(
      0.1 * LAMPORTS_PER_SOL === Number(recipientBalance),
      "recipient balance don't match expected",
    );
  });
});
