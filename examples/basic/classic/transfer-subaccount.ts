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
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
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
console.log('Starting SubAccount transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const rootAuthority = Keypair.generate();
const subAccountAuthority = Keypair.generate();
const recipient = Keypair.generate().publicKey;

await confirmAirdrop(rootAuthority.publicKey);
await confirmAirdrop(subAccountAuthority.publicKey);

await delay(2000);

// Create SWIG with root authority
console.log('Creating SWIG Wallet...');
const swigId = randomBytes(32);
const swigAddress = findSwigPda(swigId);
console.log(`SWIG PDA: ${swigAddress.toBase58()}`);

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id: swigId,
});

await sendTransaction([createSwigIx], rootAuthority);
console.log('Created SWIG wallet');

await delay(2000);

const swig = await fetchSwig(connection, swigAddress);
const rootRole = swig.findRolesByEd25519SignerPk(rootAuthority.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

// Add subaccount authority
console.log('Adding subaccount authority...');
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set().subAccount().get(),
);

await sendTransaction(addAuthorityIx, rootAuthority);
console.log('Added subaccount authority');

await delay(2000);

await swig.refetch();
const subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.publicKey,
)[0];
if (!subAccountAuthRole) throw new Error('SubAccount authority role not found');

// Create subaccount
console.log('Creating subaccount...');
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
);

await sendTransaction(createSubAccountIx, subAccountAuthority);
console.log('Created subaccount');

await delay(2000);

await swig.refetch();

// Get subaccount address and fund it
const subAccountAddress = findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);
console.log(`SubAccount address: ${subAccountAddress.toBase58()}`);

await confirmAirdrop(subAccountAddress);
console.log('Funded subaccount');

await delay(2000);

const subAccountBalance = await connection.getBalance(subAccountAddress);
console.log(`SubAccount balance: ${subAccountBalance} lamports`);

// Transfer from subaccount
console.log('Transferring from subaccount...');
const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
const transferIx = SystemProgram.transfer({
  fromPubkey: subAccountAddress,
  toPubkey: recipient,
  lamports: Number(transferAmount),
});

const signIx = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transferIx],
  true, // withSubAccount = true
);

await sendTransaction(signIx, subAccountAuthority);
console.log('Transfer completed');

// Verify results
const newSubAccountBalance = await connection.getBalance(subAccountAddress);
const recipientBalance = await connection.getBalance(recipient);

console.log(`SubAccount balance after: ${newSubAccountBalance} lamports`);
console.log(`Recipient balance: ${recipientBalance} lamports`);

console.log('Done!');
