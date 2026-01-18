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
console.log('Starting SOL destination limit transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const root = Keypair.generate();
const spender = Keypair.generate();
const authorizedRecipient = Keypair.generate().publicKey;
const unauthorizedRecipient = Keypair.generate().publicKey;

await confirmAirdrop(root.publicKey);
await confirmAirdrop(spender.publicKey);

await delay(2000);

// Create SWIG
console.log('Creating SWIG Wallet...');
const swigId = randomBytes(32);
const swigAddress = findSwigPda(swigId);
console.log(`SWIG PDA: ${swigAddress.toBase58()}`);

const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createEd25519AuthorityInfo(root.publicKey),
  id: swigId,
  payer: root.publicKey,
  actions: Actions.set().all().get(),
});

await sendTransaction([createSwigIx], root);
console.log('Created SWIG wallet');

await delay(2000);

const swig = await fetchSwig(connection, swigAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
const rootRole = swig.findRoleById(0)!;

console.log(`SWIG Wallet Address: ${swigWalletAddress.toBase58()}`);
console.log(`Authorized recipient: ${authorizedRecipient.toBase58()}`);

// Fund SWIG wallet
await confirmAirdrop(swigWalletAddress);
await confirmAirdrop(swigWalletAddress);
console.log('Funded SWIG wallet');

await delay(2000);

// Add spender with destination limit
console.log('Adding spender with SOL destination limit...');
const destinationLimit = BigInt(LAMPORTS_PER_SOL);
const addIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(spender.publicKey),
  Actions.set()
    .solDestinationLimit({
      amount: destinationLimit,
      destination: authorizedRecipient,
    })
    .get(),
);

await sendTransaction(addIx, root);
console.log('Added spender with destination limit');

await delay(2000);

await swig.refetch();
const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
if (!spenderRole) throw new Error('Spender role not found');

// Transfer to authorized recipient (should succeed)
console.log('Transferring to authorized recipient...');
const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);

const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: authorizedRecipient,
  lamports: Number(transferAmount),
});

const signIx = await getSignInstructions(swig, spenderRole.id, [transferIx]);
await sendTransaction(signIx, spender);

const recipientBalance = await connection.getBalance(authorizedRecipient);
console.log(`Authorized recipient balance: ${recipientBalance} lamports`);

// Try transfer to unauthorized recipient (should fail)
console.log('Attempting transfer to unauthorized recipient...');
const unauthorizedTransferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: unauthorizedRecipient,
  lamports: Number(transferAmount),
});

try {
  const signIx2 = await getSignInstructions(swig, spenderRole.id, [
    unauthorizedTransferIx,
  ]);
  await sendTransaction(signIx2, spender);
  throw new Error('Transfer to unauthorized recipient should have failed');
} catch (error: any) {
  if (error.message.includes('should have failed')) {
    throw error;
  }
  console.log('Transfer to unauthorized recipient failed as expected');
}

const unauthorizedBalance = await connection.getBalance(unauthorizedRecipient);
console.log(`Unauthorized recipient balance: ${unauthorizedBalance} lamports (should be 0)`);

console.log('Done!');
