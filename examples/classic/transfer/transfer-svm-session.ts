import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519SessionAuthorityInfo,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigCodec,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  type SwigAccount,
  type SwigFetchFn,
} from '@swig-wallet/classic';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { readFileSync } from 'node:fs';

function sendSVMTransaction(
  svm: LiteSVM,
  ixs: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [],
) {
  svm.expireBlockhash();

  const tx = new Transaction();
  tx.instructions = ixs;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer, ...signers);

  const res = svm.sendTransaction(tx);
  if (res instanceof FailedTransactionMetadata) {
    console.log('❌ logs:', res.meta().logs());
  }
  return res;
}

function fetchSwigAccount(svm: LiteSVM, swigAccountAddress: PublicKey): SwigAccount {
  const swigAccount = svm.getAccount(swigAccountAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return getSwigCodec().decode(swigAccount.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = fetchSwigAccount(svm, swigAccountAddress);

  const swigFetchFn: SwigFetchFn = async (swigAccountAddress) =>
    fetchSwigAccount(svm, toPublicKey(swigAccountAddress));

  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
}

console.log('starting session-ed25519...');
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const root = Keypair.generate();
svm.airdrop(root.publicKey, BigInt(LAMPORTS_PER_SOL));

const sessionKeypair = Keypair.generate();
svm.airdrop(sessionKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

const treasury = Keypair.generate().publicKey;
const id = Uint8Array.from(Array(32).fill(0));
const swigAccountAddress = findSwigPda(id);

// create swig
const rootActions = Actions.set().all().get();
const createIx = await getCreateSwigInstruction({
  authorityInfo: createEd25519SessionAuthorityInfo(root.publicKey, 100n),
  id,
  payer: root.publicKey,
  actions: rootActions,
});
sendSVMTransaction(svm, [createIx], root);

let swig = fetchSwig(svm, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

const rootRole = swig.findRoleById(0)!;

svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));

// create session
const sessionIx = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  sessionKeypair.publicKey,
  50n,
);
sendSVMTransaction(svm, sessionIx, root);

swig = fetchSwig(svm, swigAccountAddress);
const sessionRole = swig.findRoleBySessionKey(sessionKeypair.publicKey)!;

console.log('session key:', sessionRole.authority.session);

// transfer
const transfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: treasury,
  lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
});

const signTransfer = await getSignInstructions(
  swig,
  sessionRole.id,
  [transfer],
  false,
  {
    payer: sessionKeypair.publicKey,
  },
);
sendSVMTransaction(svm, signTransfer, sessionKeypair);

console.log(
  'balances: swig',
  svm.getBalance(swigWalletAddress),
  'treasury',
  svm.getBalance(treasury),
);
