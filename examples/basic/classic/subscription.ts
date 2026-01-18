import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
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
console.log('Starting Classic subscription (recurring limit) example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const root = Keypair.generate();
const subscriptionService = Keypair.generate();

await confirmAirdrop(root.publicKey);
await confirmAirdrop(subscriptionService.publicKey);
await delay(2000);

// Create Swig
const id = randomBytes(32);
const swigAccountAddress = findSwigPda(id);
console.log('Swig address:', swigAccountAddress.toBase58());

const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  payer: root.publicKey,
  actions: rootActions,
  authorityInfo: createEd25519AuthorityInfo(root.publicKey),
  id,
});

await sendTransaction([createSwigIx], root);
await delay(2000);

const swig = await fetchSwig(connection, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress.toBase58());

// Fund swig wallet
await confirmAirdrop(swigWalletAddress);
await delay(2000);

const rootRole = swig.findRolesByEd25519SignerPk(root.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

// Add subscription service authority with recurring limit
console.log('Adding subscription service with 0.1 SOL recurring limit...');
const recurringAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
const windowSlots = BigInt(50); // Small window for testing on devnet

const subscriptionActions = Actions.set()
  .solRecurringLimit({
    recurringAmount,
    window: windowSlots,
  })
  .get();

const addSubscriptionIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subscriptionService.publicKey),
  subscriptionActions,
  { payer: root.publicKey },
);

await sendTransaction(addSubscriptionIx, root);
await delay(2000);

await swig.refetch();
const subRole = swig.findRolesByEd25519SignerPk(subscriptionService.publicKey)[0];
if (!subRole) throw new Error('Subscription role not found');

// First payment (should succeed)
console.log('Attempting first 0.1 SOL payment...');
const transfer1 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: subscriptionService.publicKey,
  lamports: recurringAmount,
});

const signIx1 = await getSignInstructions(swig, subRole.id, [transfer1]);
await sendTransaction(signIx1, subscriptionService);
console.log('First payment succeeded');
await delay(2000);

// Second payment (should fail - limit reached)
console.log('Attempting second 0.1 SOL payment (same window, should fail)...');
const transfer2 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: subscriptionService.publicKey,
  lamports: recurringAmount,
});

const signIx2 = await getSignInstructions(swig, subRole.id, [transfer2]);

try {
  await sendTransaction(signIx2, subscriptionService);
  throw new Error('Second payment succeeded unexpectedly');
} catch (error: any) {
  if (error.message.includes('succeeded unexpectedly')) {
    throw error;
  }
  console.log('Second payment failed as expected (limit reached)');
}

// Wait for window to reset
console.log(`Waiting for ${windowSlots} slots to elapse...`);
const startSlot = await connection.getSlot('finalized');
const targetSlot = startSlot + Number(windowSlots) + 5;

while (true) {
  await delay(500);
  const currentSlot = await connection.getSlot('finalized');
  if (currentSlot >= targetSlot) break;
}
console.log('Window elapsed');

// Third payment (should succeed after reset)
console.log('Attempting third 0.1 SOL payment after window reset...');
await swig.refetch();
const transfer3 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: subscriptionService.publicKey,
  lamports: recurringAmount,
});

const signIx3 = await getSignInstructions(swig, subRole.id, [transfer3]);
await sendTransaction(signIx3, subscriptionService);
console.log('Third payment succeeded after reset');

console.log('Done!');
