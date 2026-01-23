import { Wallet } from '@ethereumjs/wallet';
import { p256 } from '@noble/curves/nist';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  createSecp256k1AuthorityInfo,
  createSecp256r1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddMultipleAuthoritiesInstructionBuilder,
  getCreateSwigInstructionBuilder,
  getSigningFnForSecp256k1PrivateKey,
  getSigningFnForSecp256r1PrivateKey,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

//
// Helpers
//
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

async function confirmAirdrop(
  publicKey: Keypair['publicKey'],
  amount: number = LAMPORTS_PER_SOL,
) {
  const sig = await connection.requestAirdrop(publicKey, amount);
  await connection.confirmTransaction(sig, 'confirmed');
  await delay(2000);
}

async function sendTransaction(
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [],
): Promise<string> {
  const tx = new Transaction().add(...instructions);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer, ...signers], {
    commitment: 'confirmed',
  });
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

//
// Main
//
console.log('🚀 Starting multi-curve Swig demo on devnet...');
console.log(`Using RPC: ${RPC_URL}`);

// Generate authorities
const rootEd25519 = Keypair.generate();
await confirmAirdrop(rootEd25519.publicKey);

const secp256r1 = p256.utils.randomPrivateKey();
const secp256r1PublicKey = p256.getPublicKey(secp256r1);
const secp256k1 = Wallet.generate();

// Find Swig PDA
const id = randomBytes(32);
const swigAccountAddress = findSwigPda(id);
console.log('📦 Swig account PDA:', swigAccountAddress.toBase58());

// Get current slot
const currentSlot = await connection.getSlot('finalized');

// Create Swig with secp256r1 root, add ed25519 + secp256k1 as additional
let ixs = await getCreateSwigInstructionBuilder({
  options: {
    signingFn: getSigningFnForSecp256r1PrivateKey(secp256r1),
    currentSlot: BigInt(currentSlot),
  },
  swigAddress: swigAccountAddress,
  authorityInfo: createSecp256r1AuthorityInfo(secp256r1PublicKey),
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

await sendTransaction(ixs, rootEd25519);
await delay(2000);

// Fetch swig
const swig = await fetchSwig(connection, swigAccountAddress);
console.log('✅ Swig created with roles:', swig.roles.length);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

// Get fresh slot for next operation
const currentSlot2 = await connection.getSlot('finalized');

// Add multiple authorities using secp256k1 signer
const addBuilder = await getAddMultipleAuthoritiesInstructionBuilder(swig, 2, {
  currentSlot: BigInt(currentSlot2),
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

await sendTransaction(ixs, rootEd25519);

// Refresh and log
await swig.refetch();
console.log('📊 Updated swig roles count:', swig.roles.length);
