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
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  type SwigAccount,
  type SwigFetchFn,
} from '@swig-wallet/classic';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { readFileSync } from 'node:fs';

//
// Helpers
//
function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
) {
  svm.expireBlockhash();

  const tx = new Transaction();
  tx.instructions = instructions;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);

  const res = svm.sendTransaction(tx);

  if (res instanceof FailedTransactionMetadata) {
    console.log('❌ tx logs:', res.meta().logs());
  }
  return res;
}

function fetchSwigAccount(svm: LiteSVM, swigAddress: PublicKey): SwigAccount {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return getSwigCodec().decode(Uint8Array.from(swigAccount.data));
}

function fetchSwig(svm: LiteSVM, swigAddress: PublicKey): Swig {
  const account = fetchSwigAccount(svm, swigAddress);
  const swigFetchFn: SwigFetchFn = async (addr) =>
    fetchSwigAccount(svm, toPublicKey(addr));
  return new Swig(swigAddress, account, swigFetchFn);
}

//
// Main
//
console.log('starting subaccount example...');
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const rootAuthority = Keypair.generate();
svm.airdrop(rootAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

const subAccountAuthority = Keypair.generate();
svm.airdrop(subAccountAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

const id = Uint8Array.from(Array(32).fill(2));
const swigAddress = findSwigPda(id);

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
});
sendSVMTransaction(svm, [createSwigIx], rootAuthority);

const swig = fetchSwig(svm, swigAddress);
console.log('swig account version:', swig.accountVersion());

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

const rootRole = swig.roles[0];

// add subaccount authority
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set().subAccount().get(),
);
sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

await swig.refetch();
const subAccountAuthRole = swig.roles[1];

// create subaccount
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
);
sendSVMTransaction(svm, createSubAccountIx, subAccountAuthority);

await swig.refetch();

const subAccountAddress = findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);
svm.airdrop(subAccountAddress, BigInt(LAMPORTS_PER_SOL));

console.log('sub account balance:', svm.getBalance(subAccountAddress));

const recipient = Keypair.generate().publicKey;
const transfer = SystemProgram.transfer({
  fromPubkey: subAccountAddress,
  toPubkey: recipient,
  lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
});

const signIx = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer],
  true,
);
sendSVMTransaction(svm, signIx, subAccountAuthority);

console.log('new subaccount balance:', svm.getBalance(subAccountAddress));
console.log('recipient balance:', svm.getBalance(recipient));
