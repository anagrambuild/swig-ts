import {
  createMint,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
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
console.log('Starting Classic token recurring destination limit example...');
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

// Fund swig wallet for transaction fees
await confirmAirdrop(swigWalletAddress);
await delay(2000);

const rootRole = swig.findRolesByEd25519SignerPk(root.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

// Create test token mint
console.log('Creating test token mint...');
const DECIMALS = 6;
const tokenMint = await createMint(
  connection,
  root,
  root.publicKey,
  null,
  DECIMALS,
);
console.log('Token mint:', tokenMint.toBase58());

// Create ATAs
const swigTokenAta = await getOrCreateAssociatedTokenAccount(
  connection,
  root,
  tokenMint,
  swigWalletAddress,
  true,
);

const authorizedRecipientAta = await getOrCreateAssociatedTokenAccount(
  connection,
  root,
  tokenMint,
  authorizedRecipient.publicKey,
);

const unauthorizedRecipientAta = await getOrCreateAssociatedTokenAccount(
  connection,
  root,
  tokenMint,
  unauthorizedRecipient.publicKey,
);

console.log('Authorized recipient ATA:', authorizedRecipientAta.address.toBase58());

// Mint tokens to Swig wallet's ATA
const mintAmount = BigInt(10_000) * BigInt(10 ** DECIMALS);
await mintTo(
  connection,
  root,
  tokenMint,
  swigTokenAta.address,
  root,
  Number(mintAmount),
);
console.log('Minted 10000 tokens to Swig wallet');

// Add spender with token recurring destination limit
console.log('Adding spender with token recurring destination limit...');
const recurringAmount = BigInt(500) * BigInt(10 ** DECIMALS);
const windowSlots = BigInt(50); // Small window for testing

await swig.refetch();
const spenderIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(spender.publicKey),
  Actions.set()
    .tokenRecurringDestinationLimit({
      mint: tokenMint,
      recurringAmount,
      window: windowSlots,
      destination: authorizedRecipientAta.address,
    })
    .get(),
  { payer: root.publicKey },
);

await sendTransaction(spenderIx, root);
await delay(2000);

await swig.refetch();
const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
if (!spenderRole) throw new Error('Spender role not found');

// First transfer: 200 tokens to authorized recipient (should succeed)
console.log('First transfer: 200 tokens to authorized recipient...');
const transferAmount1 = BigInt(200) * BigInt(10 ** DECIMALS);
const transfer1 = createTransferInstruction(
  swigTokenAta.address,
  authorizedRecipientAta.address,
  swigWalletAddress,
  transferAmount1,
  [],
  TOKEN_PROGRAM_ID,
);

const signIx1 = await getSignInstructions(swig, spenderRole.id, [transfer1]);
await sendTransaction(signIx1, spender);
console.log('First transfer succeeded (200 tokens)');
await delay(2000);

// Second transfer: 300 tokens (total 500, within limit)
console.log('Second transfer: 300 tokens (total 500, within limit)...');
await swig.refetch();
const transferAmount2 = BigInt(300) * BigInt(10 ** DECIMALS);
const transfer2 = createTransferInstruction(
  swigTokenAta.address,
  authorizedRecipientAta.address,
  swigWalletAddress,
  transferAmount2,
  [],
  TOKEN_PROGRAM_ID,
);

const signIx2 = await getSignInstructions(swig, spenderRole.id, [transfer2]);
await sendTransaction(signIx2, spender);
console.log('Second transfer succeeded (300 tokens, total 500)');
await delay(2000);

// Third transfer: 100 tokens (should fail - exceeds limit)
console.log('Third transfer: 100 tokens (should fail - exceeds limit)...');
await swig.refetch();
const transferAmount3 = BigInt(100) * BigInt(10 ** DECIMALS);
const transfer3 = createTransferInstruction(
  swigTokenAta.address,
  authorizedRecipientAta.address,
  swigWalletAddress,
  transferAmount3,
  [],
  TOKEN_PROGRAM_ID,
);

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

// Test transfer to unauthorized recipient (should fail)
console.log('Testing transfer to unauthorized recipient (should fail)...');
await swig.refetch();
const unauthorizedTransfer = createTransferInstruction(
  swigTokenAta.address,
  unauthorizedRecipientAta.address,
  swigWalletAddress,
  BigInt(50) * BigInt(10 ** DECIMALS),
  [],
  TOKEN_PROGRAM_ID,
);

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

// Transfer after reset (should succeed)
console.log('Transfer after window reset...');
await swig.refetch();
const transfer4 = createTransferInstruction(
  swigTokenAta.address,
  authorizedRecipientAta.address,
  swigWalletAddress,
  BigInt(200) * BigInt(10 ** DECIMALS),
  [],
  TOKEN_PROGRAM_ID,
);

const signIx4 = await getSignInstructions(swig, spenderRole.id, [transfer4]);
await sendTransaction(signIx4, spender);
console.log('Transfer after reset succeeded');

// Check balances
const swigBalance = await connection.getTokenAccountBalance(swigTokenAta.address);
const authorizedBalance = await connection.getTokenAccountBalance(
  authorizedRecipientAta.address,
);
const unauthorizedBalance = await connection.getTokenAccountBalance(
  unauthorizedRecipientAta.address,
);

console.log('Final Swig token balance:', swigBalance.value.uiAmount);
console.log('Authorized recipient balance:', authorizedBalance.value.uiAmount);
console.log(
  'Unauthorized recipient balance:',
  unauthorizedBalance.value.uiAmount,
  '(should be 0)',
);

console.log('Done!');
