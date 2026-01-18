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
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSwigAccountAddress,
  getSwigSystemAddress,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

// ---------- helpers ----------
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// ---------- main ----------
console.log('Starting get-swig-account-address example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypair
const user = Keypair.generate();
await confirmAirdrop(user.publicKey);
console.log('User public key:', user.publicKey.toBase58());

// Generate a unique swig ID
const id = randomBytes(32);

// Find the swig PDA by id
const swigAccountAddress = findSwigPda(id);
console.log('Swig account address (via findSwigPda):', swigAccountAddress.toBase58());

// Create swig with root authority
console.log('Creating SWIG...');
const rootActions = Actions.set().all().get();

const createSwigIx = await getCreateSwigInstruction({
  payer: user.publicKey,
  actions: rootActions,
  authorityInfo: createEd25519AuthorityInfo(user.publicKey),
  id,
});

await sendTransaction([createSwigIx], user);
await delay(2000);

// Fetch the swig
const swig = await fetchSwig(connection, swigAccountAddress);

// Test getSwigAccountAddress
console.log('\nTesting address functions:');
console.log('='.repeat(50));

const accountAddress = getSwigAccountAddress(swig);
console.log('getSwigAccountAddress:', accountAddress.toBase58());

// Verify addresses match
if (swigAccountAddress.toBase58() === accountAddress.toBase58()) {
  console.log('✓ getSwigAccountAddress matches findSwigPda');
} else {
  throw new Error('Address mismatch!');
}

// Test getSwigSystemAddress
const systemAddress = await getSwigSystemAddress(swig);
console.log('getSwigSystemAddress:', systemAddress.toBase58());

// Test getSwigWalletAddress
const walletAddress = await getSwigWalletAddress(swig);
console.log('getSwigWalletAddress:', walletAddress.toBase58());

// Verify wallet address based on account version
console.log('\nAccount version:', swig.accountVersion());

if (swig.accountVersion() === 'v2') {
  if (walletAddress.toBase58() === systemAddress.toBase58()) {
    console.log('✓ V2 account: wallet address equals system address');
  } else {
    throw new Error('V2 account: wallet address should equal system address');
  }
} else {
  if (walletAddress.toBase58() === accountAddress.toBase58()) {
    console.log('✓ V1 account: wallet address equals account address');
  } else {
    throw new Error('V1 account: wallet address should equal account address');
  }
}

console.log('\nDone!');
