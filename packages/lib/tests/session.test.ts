import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import {
  Actions,
  createEd25519SessionAuthorityInfo,
  findSwigPdaRaw,
  getCreateSessionInstructionContext,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  getSwigWalletAddressRaw,
  SolInstruction,
  SolPublicKey,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSwigSVMTransaction, toPublicKey } from './utils';

describe('Session Test', () => {
  const swigId = randomBytes(32);
  let swigAccountAddress: SolPublicKey;

  beforeAll(async () => {
    swigAccountAddress = (await findSwigPdaRaw(swigId))[0];
  });

  test('Ed25519Session', async () => {
    const svm = getSvm();
    const [rootAuthority, sessionKeypair] = getFundedKeys(svm);

    // create a swig
    // create swig
    const rootActions = Actions.set().all().get();
    const createIx = await getCreateSwigInstructionContext({
      authorityInfo: createEd25519SessionAuthorityInfo(
        rootAuthority.publicKey,
        100n,
      ),
      id: swigId,
      payer: rootAuthority.publicKey,
      actions: rootActions,
    });
    sendSwigSVMTransaction(svm, createIx, rootAuthority);

    let swig = fetchSwig(svm, swigAccountAddress);
    const swigWalletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
    console.log('swig wallet address:', swigWalletAddress.toBase58());

    const rootRole = swig.findRoleById(0)!;

    svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));

    // create session
    const sessionIx = await getCreateSessionInstructionContext(
      swig,
      rootRole.id,
      sessionKeypair.publicKey,
      50n,
    );
    sendSwigSVMTransaction(svm, sessionIx, rootAuthority);

    swig = fetchSwig(svm, swigAccountAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKeypair.publicKey)!;

    console.log('session key:', sessionRole.authority.session);

    const treasury = Keypair.generate().publicKey;

    // transfer
    const transfer = SystemProgram.transfer({
      fromPubkey: swigWalletAddress,
      toPubkey: treasury,
      lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
    });

    const signTransfer = await getSignInstructionContext(
      swig,
      sessionRole.id,
      [transfer].map(SolInstruction.from),
      false,
      {
        payer: sessionKeypair.publicKey,
      },
    );
    sendSwigSVMTransaction(svm, signTransfer, sessionKeypair);

    console.log(
      'balances: swig',
      svm.getBalance(swigWalletAddress),
      'treasury',
      svm.getBalance(treasury),
    );
  });
});
