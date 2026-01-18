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
console.log('Starting Classic SOL recurring destination limit example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const root = Keypair.generate();
const spender = Keypair.generate();
const authorizedRecipient = Keypair.generate();
const unauthorizedRecipient = Keypair.generate();

await confirmAirdrop(root.publicKey);
await confirmAirdrop(spender.publicKey);
await delay(2000);

// Create Swig
const id = randomBytes(32);
const swigAccountAddress = findSwigPda(id);
console.log('Swig address:', swigAccountAddress.toBase58());

const createSwigIx = await getCreateSwigInstruction({
  payer: root.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(root.publicKey),
  id,
});

await sendTransaction([createSwigIx], root);
await delay(2000);

const swig = await fetchSwig(connection, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress.toBase58());
console.log('Authorized recipient:', authorizedRecipient.publicKey.toBase58());

// Fund swig wallet
await confirmAirdrop(swigWalletAddress, 2 * LAMPORTS_PER_SOL);
await delay(2000);

const rootRole = swig.findRolesByEd25519SignerPk(root.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

// Add spender with recurring destination limit
console.log('Adding spender with SOL recurring destination limit...');
const recurringAmount = BigInt(0.5 * LAMPORTS_PER_SOL);
const windowSlots = BigInt(50); // Small window for testing

const spenderActions = Actions.set()
  .solRecurringDestinationLimit({
    recurringAmount,
    window: windowSlots,
    destination: authorizedRecipient.publicKey,
  })
  .get();

const addSpenderIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(spender.publicKey),
  spenderActions,
  { payer: root.publicKey },
);

await sendTransaction(addSpenderIx, root);
await delay(2000);

await swig.refetch();
const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
if (!spenderRole) throw new Error('Spender role not found');

console.log('Balance before transfers:', await connection.getBalance(swigWalletAddress));

// First transfer: 0.3 SOL to authorized recipient (should succeed)
console.log('First transfer: 0.3 SOL to authorized recipient...');
const transfer1 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: authorizedRecipient.publicKey,
  lamports: BigInt(0.3 * LAMPORTS_PER_SOL),
});

const signIx1 = await getSignInstructions(swig, spenderRole.id, [transfer1]);
await sendTransaction(signIx1, spender);
console.log('First transfer succeeded');
await delay(2000);

console.log(
  'Balance after first transfer:',
  await connection.getBalance(swigWalletAddress),
);

// Second transfer: 0.2 SOL (total 0.5 SOL, should succeed)
console.log('Second transfer: 0.2 SOL to authorized recipient...');
await swig.refetch();
const transfer2 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: authorizedRecipient.publicKey,
  lamports: BigInt(0.2 * LAMPORTS_PER_SOL),
});

const signIx2 = await getSignInstructions(swig, spenderRole.id, [transfer2]);
await sendTransaction(signIx2, spender);
console.log('Second transfer succeeded');
await delay(2000);

console.log(
  'Balance after second transfer:',
  await connection.getBalance(swigWalletAddress),
);

// Third transfer: 0.1 SOL (should fail - exceeds limit)
console.log('Third transfer: 0.1 SOL (should fail - exceeds limit)...');
await swig.refetch();
const transfer3 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: authorizedRecipient.publicKey,
  lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
});

try {
  const signIx3 = await getSignInstructions(swig, spenderRole.id, [transfer3]);
  await sendTransaction(signIx3, spender);
  throw new Error('Third transfer succeeded unexpectedly');
} catch (error: any) {
  if (error.message.includes('succeeded unexpectedly')) {
    throw error;
  }
  console.log('Third transfer failed as expected (limit exceeded)');
}

// Test unauthorized recipient
console.log('Testing transfer to unauthorized recipient...');
await swig.refetch();
const unauthorizedTransfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: unauthorizedRecipient.publicKey,
  lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
});

try {
  const unauthorizedSignIx = await getSignInstructions(swig, spenderRole.id, [
    unauthorizedTransfer,
  ]);
  await sendTransaction(unauthorizedSignIx, spender);
  throw new Error('Unauthorized transfer succeeded unexpectedly');
} catch (error: any) {
  if (error.message.includes('succeeded unexpectedly')) {
    throw error;
  }
  console.log('Unauthorized transfer failed as expected (wrong destination)');
}

// Wait for window to reset and test again
console.log(`Waiting for ${windowSlots} slots to elapse...`);
const startSlot = await connection.getSlot('finalized');
const targetSlot = startSlot + Number(windowSlots) + 5;

while (true) {
  await delay(500);
  const currentSlot = await connection.getSlot('finalized');
  if (currentSlot >= targetSlot) break;
}
console.log('Window elapsed');

// Transfer after reset (should succeed)
console.log('Transfer after window reset...');
await swig.refetch();
const transfer4 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: authorizedRecipient.publicKey,
  lamports: BigInt(0.3 * LAMPORTS_PER_SOL),
});

const signIx4 = await getSignInstructions(swig, spenderRole.id, [transfer4]);
await sendTransaction(signIx4, spender);
console.log('Transfer after reset succeeded');

console.log(
  'Final balance:',
  await connection.getBalance(swigWalletAddress),
);
console.log(
  'Authorized recipient balance:',
  await connection.getBalance(authorizedRecipient.publicKey),
);

console.log('Done!');
