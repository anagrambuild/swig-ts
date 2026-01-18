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
  createSecp256k1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
  type InstructionDataOptions,
} from '@swig-wallet/classic';

// ---------- helpers ----------
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

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
console.log('Starting Secp256k1 transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create EVM wallet for secp256k1 authority
const userWallet = Wallet.generate();
console.log(`Generated secp256k1 authority: ${userWallet.getAddressString()}`);

// Create root user (fee payer)
const rootUser = Keypair.generate();
await confirmAirdrop(rootUser.publicKey);

// Create transaction signer
const transactionSigner = Keypair.generate();
await confirmAirdrop(transactionSigner.publicKey);

// Create recipient address
const recipient = Keypair.generate().publicKey;
console.log(`Recipient address: ${recipient.toBase58()}`);

await delay(2000);

// Create SWIG wallet
console.log('Creating SWIG Wallet...');
const swigId = Uint8Array.from(Array(32).fill(1));
const swigPda = findSwigPda(swigId);
console.log(`SWIG PDA: ${swigPda.toBase58()}`);

const rootActions = Actions.set().all().get();
const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(userWallet.getPublicKey()),
  id: swigId,
  payer: rootUser.publicKey,
  actions: rootActions,
});

await sendTransaction([createSwigInstruction], rootUser);
console.log('Created SWIG wallet with secp256k1 root authority');

// Fetch SWIG account and get wallet address
console.log('Fetching SWIG Account...');
const swig = await fetchSwig(connection, swigPda);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log(`SWIG Wallet Address: ${swigWalletAddress.toBase58()}`);

// Fund the SWIG wallet
await confirmAirdrop(swigWalletAddress);
console.log('Funded SWIG wallet');

await delay(2000);

// Find role by secp256k1 authority
console.log('Finding Authority Role...');
const roles = swig.findRolesBySecp256k1SignerAddress(userWallet.getAddress());
if (roles.length === 0) {
  throw new Error('Role not found for secp256k1 authority');
}
const rootRole = roles[0];
console.log(`Found role ID: ${rootRole.id}`);

// Prepare signing context
const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKey(),
);
const slot = await connection.getSlot('finalized');
const instOptions: InstructionDataOptions = {
  currentSlot: BigInt(slot),
  signingFn,
};

// Perform SOL transfer
console.log('Performing SOL Transfer...');
const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
console.log(`Transferring ${transferAmount.toString()} lamports (0.1 SOL)`);

const balanceBefore = await connection.getBalance(swigWalletAddress);
console.log(`SWIG wallet balance before: ${balanceBefore} lamports`);

const transferInstruction = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: recipient,
  lamports: transferAmount,
});

const signInstructions = await getSignInstructions(
  swig,
  rootRole.id,
  [transferInstruction],
  false,
  { ...instOptions, payer: transactionSigner.publicKey },
);

await sendTransaction(signInstructions, transactionSigner);
console.log('Transfer completed successfully');

// Refetch SWIG state after modification
await swig.refetch();

const balanceAfter = await connection.getBalance(swigWalletAddress);
console.log(`SWIG wallet balance after: ${balanceAfter} lamports`);
console.log(`Transfer cost: ${(balanceBefore - balanceAfter).toString()} lamports`);

console.log('Done!');
