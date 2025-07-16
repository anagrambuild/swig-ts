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
  createEd25519AuthorityInfo,
  findSwigPda,
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigCodec,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  type SwigAccount,
  type SwigFetchFn,
} from '@swig-wallet/classic';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';

//
// Helpers
//
function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
) {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer);

  const tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx:', tx.meta().logs());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
  }
}

function fetchSwigAccount(svm: LiteSVM, swigAddress: PublicKey): SwigAccount {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  // Ensure we have a proper Uint8Array for the account data
  return getSwigCodec().decode(swigAccount.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = fetchSwigAccount(svm, swigAddress);

  const swigFetchFn: SwigFetchFn = async (swigAddress) =>
    fetchSwigAccount(svm, swigAddress as PublicKey);

  return new Swig(swigAddress, swigAccount, swigFetchFn);
}

console.log('starting...');
//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

// root authority
//
const rootAuthority = Keypair.generate();
svm.airdrop(rootAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

// sub account authority
//
const subAccountAuthority = Keypair.generate();
svm.airdrop(subAccountAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

const id = Uint8Array.from(Array(32).fill(2));

const swigAddress = findSwigPda(id);

console.log('swig address:', swigAddress.toBase58());

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
});
sendSVMTransaction(svm, [createSwigIx], rootAuthority);

let swig = fetchSwig(svm, swigAddress);

let rootRole = swig.roles[0];

// add a sub account authority
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set().subAccount().get(),
);
sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

await swig.refetch();

let subAccountAuthRole = swig.roles[1];

// create sub account
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
);
sendSVMTransaction(svm, createSubAccountIx, subAccountAuthority);

await swig.refetch();

rootRole = swig.roles[0];
subAccountAuthRole = swig.roles[1];

const subAccountAddress = findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);

svm.airdrop(subAccountAddress, BigInt(LAMPORTS_PER_SOL));

const subBalance = svm.getBalance(subAccountAddress)!;

console.log('sub account balance:', subBalance);

const recipient = Keypair.generate().publicKey;

const transfer = SystemProgram.transfer({
  fromPubkey: subAccountAddress,
  toPubkey: recipient,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

const signIx = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer],
  true,
);
sendSVMTransaction(svm, signIx, subAccountAuthority);

const newSubBalance = svm.getBalance(subAccountAddress)!;

console.log('new subaccount balance:', newSubBalance);

const recipientBalance = svm.getBalance(recipient)!;

console.log('recipient balance:', recipientBalance);
