import { Wallet } from '@ethereumjs/wallet';
import { p256 } from '@noble/curves/nist';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  createSecp256k1AuthorityInfo,
  createSecp256r1AuthorityInfo,
  findSwigPda,
  getAddMultipleAuthoritiesInstructionBuilder,
  getCreateSwigInstructionBuilder,
  getSigningFnForSecp256k1PrivateKey,
  getSigningFnForSecp256r1PrivateKey,
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
  signers: Keypair[] = [],
) {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer, ...signers);

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

  // swigAddress: SolPublicKey
  const swigFetchFn: SwigFetchFn = async (swigAddress) =>
    fetchSwigAccount(svm, new PublicKey((swigAddress as any).toBase58()));

  return new Swig(swigAddress, swigAccount, swigFetchFn);
}

console.log('starting...');
//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

// ed25519 authority root
//
const ed25519Keypair = Keypair.generate();
svm.airdrop(ed25519Keypair.publicKey, BigInt(LAMPORTS_PER_SOL));

// secp256r1 authority
//
const r1Keypair = p256.keygen();

// secp256k1 authority
//
const k1Keypair = Wallet.generate();

const id = Uint8Array.from(Array(32).fill(2));

const swigAddress = findSwigPda(id);

console.log('swig address:', swigAddress.toBase58());

let ixs = await getCreateSwigInstructionBuilder({
  options: {
    signingFn: getSigningFnForSecp256r1PrivateKey(r1Keypair.secretKey),
    currentSlot: svm.getClock().slot,
  },
  swigAddress,
  authorityInfo: createSecp256r1AuthorityInfo(r1Keypair.publicKey),
  id,
  payer: ed25519Keypair.publicKey,
  actions: Actions.set().all().get(),
})
  .addAuthority(
    createEd25519AuthorityInfo(ed25519Keypair.publicKey),
    Actions.set().manageAuthority().get(),
  )
  .addAuthority(
    createSecp256k1AuthorityInfo(k1Keypair.getPublicKey()),
    Actions.set().all().get(),
  )
  .getInstructions();

sendSVMTransaction(svm, ixs, ed25519Keypair);

const swig = fetchSwig(svm, swigAddress);

console.log('swig roles count:', swig.roles.length);

const instructionBuilder = await getAddMultipleAuthoritiesInstructionBuilder(
  swig,
  2,
  {
    currentSlot: svm.getClock().slot,
    payer: ed25519Keypair.publicKey,
    signingFn: getSigningFnForSecp256k1PrivateKey(k1Keypair.getPrivateKey()),
  },
);

ixs = await instructionBuilder
  .addAuthority(
    createEd25519AuthorityInfo(Keypair.generate().publicKey),
    Actions.set().all().get(),
  )
  .addAuthority(
    createEd25519AuthorityInfo(Keypair.generate().publicKey),
    Actions.set().all().get(),
  )
  .getInstructions();

sendSVMTransaction(svm, ixs, ed25519Keypair);

await swig.refetch();

console.log('swig roles count:', swig.roles.length);