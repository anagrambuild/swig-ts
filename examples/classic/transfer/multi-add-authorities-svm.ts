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
  const tx = new Transaction();
  tx.instructions = instructions;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();

  tx.sign(payer, ...signers);

  const result = svm.sendTransaction(tx);

  if (result instanceof FailedTransactionMetadata) {
    console.error('❌ Transaction failed:\n', result.meta().logs());
  } else if (result instanceof TransactionMetadata) {
    console.log('✅ Transaction succeeded');
  }
}

function fetchSwigAccount(svm: LiteSVM, swigAddress: PublicKey): SwigAccount {
  const account = svm.getAccount(swigAddress);
  if (!account) throw new Error('Swig account not created');
  return getSwigCodec().decode(account.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const account = fetchSwigAccount(svm, swigAddress);
  const swigFetchFn: SwigFetchFn = async (addr) =>
    fetchSwigAccount(svm, new PublicKey((addr as any).toBase58()));
  return new Swig(swigAddress, account, swigFetchFn);
}

//
// Main
//
console.log('🚀 Starting multi-curve Swig demo...');

// Load program into LiteSVM
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

// Generate authorities
const rootEd25519 = Keypair.generate();
svm.airdrop(rootEd25519.publicKey, BigInt(LAMPORTS_PER_SOL));

const secp256r1 = p256.keygen();
const secp256k1 = Wallet.generate();

// Find Swig PDA
const id = Uint8Array.from(Array(32).fill(7)); // random but fixed id
const swigAddress = findSwigPda(id);
console.log('📦 Swig account PDA:', swigAddress.toBase58());

// Create Swig with secp256r1 root, add ed25519 + secp256k1 as additional
let ixs = await getCreateSwigInstructionBuilder({
  options: {
    signingFn: getSigningFnForSecp256r1PrivateKey(secp256r1.secretKey),
    currentSlot: svm.getClock().slot,
  },
  swigAddress,
  authorityInfo: createSecp256r1AuthorityInfo(secp256r1.publicKey),
  id,
  payer: rootEd25519.publicKey,
  actions: Actions.set().all().get(),
})
  .addAuthority(
    createEd25519AuthorityInfo(rootEd25519.publicKey),
    Actions.set().manageAuthority().get(),
  )
  .addAuthority(
    createSecp256k1AuthorityInfo(secp256k1.getPublicKey()),
    Actions.set().all().get(),
  )
  .getInstructions();

sendSVMTransaction(svm, ixs, rootEd25519);

// Fetch swig
const swig = fetchSwig(svm, swigAddress);
console.log('✅ Swig created with roles:', swig.roles.length);

// Add multiple authorities using secp256k1 signer
const addBuilder = await getAddMultipleAuthoritiesInstructionBuilder(swig, 2, {
  currentSlot: svm.getClock().slot,
  payer: rootEd25519.publicKey,
  signingFn: getSigningFnForSecp256k1PrivateKey(secp256k1.getPrivateKey()),
});

ixs = await addBuilder
  .addAuthority(
    createEd25519AuthorityInfo(Keypair.generate().publicKey),
    Actions.set().all().get(),
  )
  .addAuthority(
    createEd25519AuthorityInfo(Keypair.generate().publicKey),
    Actions.set().all().get(),
  )
  .getInstructions();

sendSVMTransaction(svm, ixs, rootEd25519);

// Refresh and log
await swig.refetch();
console.log('📊 Updated swig roles count:', swig.roles.length);
