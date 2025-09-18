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
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
} from '@swig-wallet/classic';

// --- Helpers ---
async function sendAndConfirm(
  conn: Connection,
  ixs: TransactionInstruction[],
  feePayer: Keypair,
  extra: Keypair[] = [],
) {
  const tx = new Transaction().add(...ixs);
  const sig = await sendAndConfirmTransaction(conn, tx, [feePayer, ...extra], {
    commitment: 'confirmed',
  });
  console.log(`🔗 Sent tx: https://explorer.solana.com/tx/${sig}?cluster=custom`);
  return sig;
}

function randomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Config ---
const conn = new Connection('http://localhost:8899', 'confirmed');
const userRoot = Keypair.generate();
const userMgr = Keypair.generate();
const devWallet = Keypair.generate();
const recipient = Keypair.generate();

for (const kp of [userRoot, userMgr, devWallet, recipient]) {
  await conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
}
await sleep(3000);

// --- Create Swig ---
const id = randomBytes(32);
const swigAddr = findSwigPda(id);

const createSwigIx = await getCreateSwigInstruction({
  payer: userRoot.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(userRoot.publicKey),
  id,
});
await sendAndConfirm(conn, [createSwigIx], userRoot);
await sleep(2000);

const swig = await fetchSwig(conn, swigAddr);

// --- Add Manager Role ---
const rootRole = swig.findRolesByEd25519SignerPk(userRoot.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

const mgrIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(userMgr.publicKey),
  Actions.set().manageAuthority().get(),
);
await sendAndConfirm(conn, mgrIx, userRoot);
await sleep(2000);

await swig.refetch();
const mgrRole = swig.findRolesByEd25519SignerPk(userMgr.publicKey)[0];
if (!mgrRole) throw new Error('Manager role not found');

// --- Create Test USDC Mint ---
const DECIMALS = 6;
const usdcMint = await createMint(
  conn,
  devWallet,
  devWallet.publicKey,
  null,
  DECIMALS,
);
console.log('🪙 USDC Mint:', usdcMint.toBase58());

const swigUsdcAta = await getOrCreateAssociatedTokenAccount(
  conn,
  devWallet,
  usdcMint,
  swigAddr,
  true,
);
const recipUsdcAta = await getOrCreateAssociatedTokenAccount(
  conn,
  devWallet,
  usdcMint,
  recipient.publicKey,
);

// Mint 1000 USDC to Swig
const mintAmount = BigInt(1_000) * BigInt(10 ** DECIMALS);
await mintTo(conn, devWallet, usdcMint, swigUsdcAta.address, devWallet, Number(mintAmount));
console.log('💧 Minted 1000 USDC to Swig');

// --- Add Dev Role with Token Limit ---
await swig.refetch();
const devIx = await getAddAuthorityInstructions(
  swig,
  mgrRole.id,
  createEd25519AuthorityInfo(devWallet.publicKey),
  Actions.set()
    .tokenLimit({ mint: usdcMint, amount: mintAmount })
    .get(),
);
await sendAndConfirm(conn, devIx, userMgr);
await sleep(2000);

await swig.refetch();
const devRole = swig.findRolesByEd25519SignerPk(devWallet.publicKey)[0];
if (!devRole) throw new Error('Dev role not found');

// --- Transfer 250 USDC to recipient ---
const transferAmount = BigInt(250) * BigInt(10 ** DECIMALS);
const xferIx = createTransferInstruction(
  swigUsdcAta.address,
  recipUsdcAta.address,
  swigAddr,
  transferAmount,
  [],
  TOKEN_PROGRAM_ID,
);
const signed = await getSignInstructions(swig, devRole.id, [xferIx]);
const sig = await sendAndConfirm(conn, signed, devWallet);

console.log('✅ Transfer complete');
console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=custom`);

console.log(
  'Swig USDC balance:',
  (await conn.getTokenAccountBalance(swigUsdcAta.address)).value.uiAmount,
);
console.log(
  'Recipient USDC balance:',
  (await conn.getTokenAccountBalance(recipUsdcAta.address)).value.uiAmount,
);
