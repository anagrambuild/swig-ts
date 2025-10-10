import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import assert from 'node:assert';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  findSwigSubAccountPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  SolInstruction,
  SolPublicKey,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSwigSVMTransaction, toPublicKey } from './utils';

describe('SubAccount Test', () => {
  const swigId = randomBytes(32);
  let swigAddress: SolPublicKey;

  beforeAll(async () => {
    swigAddress = (await findSwigPdaRaw(swigId))[0];
  });

  test('SubAccount', async () => {
    const svm = getSvm();
    const [rootAuthority, subAccountAuthority] = getFundedKeys(svm);

    // create a swig
    const createSwigIxCtx = await getCreateSwigInstructionContext({
      payer: rootAuthority.publicKey,
      actions: Actions.set().all().get(),
      authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
      id: swigId,
    });

    sendSwigSVMTransaction(svm, createSwigIxCtx, rootAuthority);

    let swig = fetchSwig(svm, swigAddress);

    let rootRole = swig.roles[0];

    // add a sub account authority
    const addAuthorityIxCtx = await getAddAuthorityInstructionContext(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(subAccountAuthority.publicKey),
      Actions.set().subAccount().get(),
    );
    sendSwigSVMTransaction(svm, addAuthorityIxCtx, rootAuthority);

    swig = fetchSwig(svm, swigAddress);

    let subAccountAuthRole = swig.roles[1];

    // create sub account
    const createSubAccountIxCtx = await getCreateSubAccountInstructionContext(
      swig,
      subAccountAuthRole.id,
    );
    sendSwigSVMTransaction(svm, createSubAccountIxCtx, subAccountAuthority);

    swig = fetchSwig(svm, swigAddress);

    rootRole = swig.roles[0];
    subAccountAuthRole = swig.roles[1];

    const subAccountAddress = toPublicKey(
      (
        await findSwigSubAccountPdaRaw(
          subAccountAuthRole.swigId,
          subAccountAuthRole.id,
        )
      )[0],
    );

    svm.airdrop(subAccountAddress, BigInt(LAMPORTS_PER_SOL));

    const subBalance = svm.getBalance(subAccountAddress)!;

    const recipient = Keypair.generate().publicKey;

    const transfer = SystemProgram.transfer({
      fromPubkey: subAccountAddress,
      toPubkey: recipient,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    });

    const signIx = await getSignInstructionContext(
      swig,
      subAccountAuthRole.id,
      [SolInstruction.from(transfer)],
      true,
    );
    sendSwigSVMTransaction(svm, signIx, subAccountAuthority);

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
