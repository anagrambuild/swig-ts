import { p256 } from '@noble/curves/nist';
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
  createSecp256r1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256r1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
  type InstructionDataOptions,
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
console.log('Starting Secp256r1 (P256/WebAuthn) transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create P256 keypair for secp256r1 authority
const r1PrivateKey = p256.utils.randomPrivateKey();
const r1PublicKey = p256.getPublicKey(r1PrivateKey);
console.log('Generated secp256r1 (P256) authority');

// Create fee payer
const payer = Keypair.generate();
await confirmAirdrop(payer.publicKey);

// Create recipient
const recipient = Keypair.generate().publicKey;
console.log(`Recipient address: ${recipient.toBase58()}`);

await delay(2000);

// Create SWIG wallet with secp256r1 authority
console.log('Creating SWIG Wallet with P256 authority...');
const swigId = randomBytes(32);
const swigPda = findSwigPda(swigId);
console.log(`SWIG PDA: ${swigPda.toBase58()}`);

const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256r1AuthorityInfo(r1PublicKey),
  id: swigId,
  payer: payer.publicKey,
  actions: rootActions,
});

await sendTransaction([createSwigIx], payer);
console.log('Created SWIG wallet with secp256r1 root authority');

// Fetch SWIG account and get wallet address
await delay(2000);
const swig = await fetchSwig(connection, swigPda);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log(`SWIG Wallet Address: ${swigWalletAddress.toBase58()}`);

// Fund the SWIG wallet
await confirmAirdrop(swigWalletAddress);
console.log('Funded SWIG wallet');

await delay(2000);

// Find role by compressed P256 public key
const r1CompressedPub = p256.getPublicKey(r1PrivateKey, true);
const roles = swig.findRolesByAuthoritySigner(r1CompressedPub);
if (roles.length === 0) {
  throw new Error('Role not found for secp256r1 authority');
}
const rootRole = roles[0];
console.log(`Found role ID: ${rootRole.id}`);

// Prepare signing context
const signingFn = getSigningFnForSecp256r1PrivateKey(r1PrivateKey);
const slot = await connection.getSlot('finalized');
const instOptions: InstructionDataOptions = {
  currentSlot: BigInt(slot),
  signingFn,
  payer: payer.publicKey,
};

// Perform SOL transfer
console.log('Performing SOL Transfer...');
const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
console.log(`Transferring ${transferAmount.toString()} lamports (0.1 SOL)`);

const balanceBefore = await connection.getBalance(swigWalletAddress);
console.log(`SWIG wallet balance before: ${balanceBefore} lamports`);

const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: recipient,
  lamports: transferAmount,
});

const signIxs = await getSignInstructions(
  swig,
  rootRole.id,
  [transferIx],
  false,
  instOptions,
);

await sendTransaction(signIxs, payer);
console.log('Transfer completed successfully');

const balanceAfter = await connection.getBalance(swigWalletAddress);
console.log(`SWIG wallet balance after: ${balanceAfter} lamports`);

const recipientBalance = await connection.getBalance(recipient);
console.log(`Recipient balance: ${recipientBalance} lamports`);

console.log('Done!');
