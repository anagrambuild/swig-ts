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
  createEd25519SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
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
console.log('Starting session transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Root authority (session-based)
const userRootKeypair = Keypair.generate();
await confirmAirdrop(userRootKeypair.publicKey);

// Dapp session authority (will spend within limit)
const dappSessionKeypair = Keypair.generate();
await confirmAirdrop(dappSessionKeypair.publicKey);

// Treasury (recipient)
const dappTreasury = Keypair.generate().publicKey;

await delay(2000);

// Deterministic Swig PDA
const id = randomBytes(32);
const swigAccountAddress = findSwigPda(id);

// 1) Create Swig with a root *session* authority (with its own limit)
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  id,
  authorityInfo: createEd25519SessionAuthorityInfo(
    userRootKeypair.publicKey,
    100n,
  ), // root session limit (lamports)
  actions: rootActions,
  payer: userRootKeypair.publicKey,
});

await sendTransaction([createSwigIx], userRootKeypair);
await delay(2000);

// Fetch Swig account
const swig = await fetchSwig(connection, swigAccountAddress);

const rootRole = swig.findRoleById(0);
if (!rootRole) throw new Error('Root role not found');

// 2) Create a session for the dapp (spend limit = 50 lamports in this demo)
const createSessionIxs = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  dappSessionKeypair.publicKey,
  50n, // session spend limit (lamports)
  { payer: userRootKeypair.publicKey },
);

await sendTransaction(createSessionIxs, userRootKeypair);
await delay(2000);

// 3) Fund the swig wallet PDA
const swigWalletAddress = await getSwigWalletAddress(swig);
await confirmAirdrop(swigWalletAddress);
await delay(2000);

await swig.refetch();

console.log('Swig wallet address:', swigWalletAddress.toBase58());

console.log(
  'Roles spend SOL capability:',
  swig.roles.map((r) => ({
    id: r.id.toString(),
    canSpend01: r.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
  })),
);

console.log(
  'Swig wallet balance (before):',
  await connection.getBalance(swigWalletAddress),
);
console.log(
  'Treasury balance (before):',
  await connection.getBalance(dappTreasury),
);

// 4) Spend from the session (0.1 SOL)
const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey);
if (!sessionRole || !sessionRole.isSessionBased()) {
  throw new Error('Session role not found or not session based');
}

// Wrap the transfer for Swig to co-sign
const signIxs = await getSignInstructions(
  swig,
  sessionRole.id,
  [transferIx],
  false,
  { payer: dappSessionKeypair.publicKey },
);

await sendTransaction(signIxs, dappSessionKeypair);
await delay(2000);

console.log(
  'Swig wallet balance (after):',
  await connection.getBalance(swigWalletAddress),
);
console.log(
  'Treasury balance (after):',
  await connection.getBalance(dappTreasury),
);

console.log('Done!');
