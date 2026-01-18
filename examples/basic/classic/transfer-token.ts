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
console.log('Starting Classic SPL token transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const root = Keypair.generate();
const manager = Keypair.generate();
const dapp = Keypair.generate();
const recipient = Keypair.generate();

await confirmAirdrop(root.publicKey);
await confirmAirdrop(manager.publicKey);
await confirmAirdrop(dapp.publicKey);
await confirmAirdrop(recipient.publicKey);
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

// Add manager role
const mgrIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(manager.publicKey),
  Actions.set().manageAuthority().get(),
  { payer: root.publicKey },
);
await sendTransaction(mgrIx, root);
await delay(2000);

await swig.refetch();
const mgrRole = swig.findRolesByEd25519SignerPk(manager.publicKey)[0];
if (!mgrRole) throw new Error('Manager role not found');

// Create test token mint
console.log('Creating test token mint...');
const DECIMALS = 6;
const tokenMint = await createMint(
  connection,
  dapp,
  dapp.publicKey,
  null,
  DECIMALS,
);
console.log('Token mint:', tokenMint.toBase58());

// Create ATAs
const swigTokenAta = await getOrCreateAssociatedTokenAccount(
  connection,
  dapp,
  tokenMint,
  swigWalletAddress,
  true, // allowOwnerOffCurve for PDA
);
const recipientTokenAta = await getOrCreateAssociatedTokenAccount(
  connection,
  dapp,
  tokenMint,
  recipient.publicKey,
);

// Mint tokens to Swig wallet's ATA
const mintAmount = BigInt(1_000) * BigInt(10 ** DECIMALS);
await mintTo(
  connection,
  dapp,
  tokenMint,
  swigTokenAta.address,
  dapp,
  Number(mintAmount),
);
console.log('Minted 1000 tokens to Swig wallet');

// Add dapp role with token limit
console.log('Adding dapp role with token limit...');
await swig.refetch();
const devIx = await getAddAuthorityInstructions(
  swig,
  mgrRole.id,
  createEd25519AuthorityInfo(dapp.publicKey),
  Actions.set().tokenLimit({ mint: tokenMint, amount: mintAmount }).get(),
  { payer: manager.publicKey },
);
await sendTransaction(devIx, manager);
await delay(2000);

await swig.refetch();
const dappRole = swig.findRolesByEd25519SignerPk(dapp.publicKey)[0];
if (!dappRole) throw new Error('Dapp role not found');

// Transfer 250 tokens to recipient
console.log('Transferring 250 tokens to recipient...');
const transferAmount = BigInt(250) * BigInt(10 ** DECIMALS);
const transferIx = createTransferInstruction(
  swigTokenAta.address,
  recipientTokenAta.address,
  swigWalletAddress,
  transferAmount,
  [],
  TOKEN_PROGRAM_ID,
);

const signedIxs = await getSignInstructions(swig, dappRole.id, [transferIx]);
await sendTransaction(signedIxs, dapp);

const swigBalance = await connection.getTokenAccountBalance(swigTokenAta.address);
const recipientBalance = await connection.getTokenAccountBalance(
  recipientTokenAta.address,
);

console.log('Swig token balance:', swigBalance.value.uiAmount);
console.log('Recipient token balance:', recipientBalance.value.uiAmount);

// Second transfer (should also succeed within limit)
console.log('Transferring another 250 tokens...');
await swig.refetch();
const transferIx2 = createTransferInstruction(
  swigTokenAta.address,
  recipientTokenAta.address,
  swigWalletAddress,
  transferAmount,
  [],
  TOKEN_PROGRAM_ID,
);

const signedIxs2 = await getSignInstructions(swig, dappRole.id, [transferIx2]);
await sendTransaction(signedIxs2, dapp);

const finalSwigBalance = await connection.getTokenAccountBalance(
  swigTokenAta.address,
);
const finalRecipientBalance = await connection.getTokenAccountBalance(
  recipientTokenAta.address,
);

console.log('Final Swig token balance:', finalSwigBalance.value.uiAmount);
console.log('Final recipient token balance:', finalRecipientBalance.value.uiAmount);

console.log('Done!');
