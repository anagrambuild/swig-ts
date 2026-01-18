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
console.log('Starting Classic token destination limit example...');
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
const mintAmount = BigInt(1_000) * BigInt(10 ** DECIMALS);
await mintTo(
  connection,
  root,
  tokenMint,
  swigTokenAta.address,
  root,
  Number(mintAmount),
);
console.log('Minted 1000 tokens to Swig wallet');

// Add spender with token destination limit
console.log('Adding spender with token destination limit...');
const tokenLimitAmount = BigInt(500) * BigInt(10 ** DECIMALS);

await swig.refetch();
const spenderIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(spender.publicKey),
  Actions.set()
    .tokenDestinationLimit({
      mint: tokenMint,
      amount: tokenLimitAmount,
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

// First transfer: 100 tokens to authorized recipient (should succeed)
console.log('First transfer: 100 tokens to authorized recipient...');
const transferAmount = BigInt(100) * BigInt(10 ** DECIMALS);
const transfer1 = createTransferInstruction(
  swigTokenAta.address,
  authorizedRecipientAta.address,
  swigWalletAddress,
  transferAmount,
  [],
  TOKEN_PROGRAM_ID,
);

const signIx1 = await getSignInstructions(swig, spenderRole.id, [transfer1]);
await sendTransaction(signIx1, spender);
console.log('First transfer succeeded');
await delay(2000);

// Second transfer: 100 tokens to authorized recipient (should succeed)
console.log('Second transfer: 100 tokens to authorized recipient...');
await swig.refetch();
const transfer2 = createTransferInstruction(
  swigTokenAta.address,
  authorizedRecipientAta.address,
  swigWalletAddress,
  transferAmount,
  [],
  TOKEN_PROGRAM_ID,
);

const signIx2 = await getSignInstructions(swig, spenderRole.id, [transfer2]);
await sendTransaction(signIx2, spender);
console.log('Second transfer succeeded');
await delay(2000);

// Test transfer to unauthorized recipient (should fail)
console.log('Testing transfer to unauthorized recipient (should fail)...');
await swig.refetch();
const unauthorizedTransfer = createTransferInstruction(
  swigTokenAta.address,
  unauthorizedRecipientAta.address,
  swigWalletAddress,
  transferAmount,
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
