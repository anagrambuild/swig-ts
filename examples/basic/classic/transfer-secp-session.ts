import { Wallet } from '@ethereumjs/wallet';
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
  createSecp256k1SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
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
console.log('Starting Secp256k1 session transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create EVM wallet for secp256k1 session authority
const userWallet = Wallet.generate();
console.log(`Generated secp256k1 authority: ${userWallet.getAddressString()}`);

// Create fee payer and session key
const payer = Keypair.generate();
const sessionKey = Keypair.generate();
const recipient = Keypair.generate().publicKey;

await confirmAirdrop(payer.publicKey);
await confirmAirdrop(sessionKey.publicKey);

await delay(2000);

// Create SWIG with secp256k1 session authority
console.log('Creating SWIG Wallet with secp256k1 session authority...');
const swigId = randomBytes(32);
const swigPda = findSwigPda(swigId);
console.log(`SWIG PDA: ${swigPda.toBase58()}`);

const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1SessionAuthorityInfo(
    userWallet.getPublicKey(),
    100n, // max session duration (slots)
  ),
  id: swigId,
  payer: payer.publicKey,
  actions: rootActions,
});

await sendTransaction([createSwigIx], payer);
console.log('Created SWIG wallet');

await delay(2000);

let swig = await fetchSwig(connection, swigPda);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log(`SWIG Wallet Address: ${swigWalletAddress.toBase58()}`);

const rootRole = swig.findRoleById(0);
if (!rootRole) throw new Error('Root role not found');
console.log(`Root role is session-based: ${rootRole.isSessionBased()}`);

// Fund the SWIG wallet
await confirmAirdrop(swigWalletAddress);
console.log('Funded SWIG wallet');

await delay(2000);

// Create session (requires Ethereum signature)
console.log('Creating session...');
const slot = await connection.getSlot('finalized');
const signingFn = getSigningFnForSecp256k1PrivateKey(userWallet.getPrivateKey());

const sessionIx = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  sessionKey.publicKey,
  50n, // session duration (slots)
  {
    currentSlot: BigInt(slot),
    signingFn,
    payer: payer.publicKey,
  },
);

await sendTransaction(sessionIx, payer);
console.log('Session created');

await delay(2000);

await swig.refetch();
const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
if (!sessionRole) throw new Error('Session role not found');
console.log(`Session role ID: ${sessionRole.id}`);

// Transfer using session key (no signingFn needed - session key signs)
console.log('Transferring with session key...');
const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);

const balanceBefore = await connection.getBalance(swigWalletAddress);
console.log(`SWIG wallet balance before: ${balanceBefore} lamports`);

const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: recipient,
  lamports: Number(transferAmount),
});

const signIx = await getSignInstructions(
  swig,
  sessionRole.id,
  [transferIx],
  false,
  { payer: sessionKey.publicKey },
);

await sendTransaction(signIx, sessionKey);
console.log('Transfer completed');

const balanceAfter = await connection.getBalance(swigWalletAddress);
const recipientBalance = await connection.getBalance(recipient);

console.log(`SWIG wallet balance after: ${balanceAfter} lamports`);
console.log(`Recipient balance: ${recipientBalance} lamports`);

console.log('Done!');
