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
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getWithdrawFromSubAccountCheckedInstructions,
  getWithdrawFromSubAccountInstructions,
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
console.log('Starting Classic withdraw subaccount example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const rootAuthority = Keypair.generate();
const subAccountAuthority = Keypair.generate();

await confirmAirdrop(rootAuthority.publicKey);
await confirmAirdrop(subAccountAuthority.publicKey);
await delay(2000);

// Create Swig
const id = randomBytes(32);
const swigAccountAddress = findSwigPda(id);
console.log('Swig address:', swigAccountAddress.toBase58());

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
});

await sendTransaction([createSwigIx], rootAuthority);
await delay(2000);

const swig = await fetchSwig(connection, swigAccountAddress);

const rootRole = swig.findRolesByEd25519SignerPk(rootAuthority.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

// Add subaccount authority
console.log('Adding subaccount authority...');
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set().subAccount().get(),
  { payer: rootAuthority.publicKey },
);

await sendTransaction(addAuthorityIx, rootAuthority);
await delay(2000);

await swig.refetch();

let subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.publicKey,
)[0];
if (!subAccountAuthRole) throw new Error('Subaccount authority role not found');

// Create subaccount
console.log('Creating subaccount...');
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  { payer: subAccountAuthority.publicKey },
);

await sendTransaction(createSubAccountIx, subAccountAuthority);
await delay(2000);

await swig.refetch();

subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.publicKey,
)[0]!;

const subAccountAddress = findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);
console.log('Subaccount address:', subAccountAddress.toBase58());

// Fund subaccount
await confirmAirdrop(subAccountAddress, 2 * LAMPORTS_PER_SOL);
await delay(2000);

const initialBalance = await connection.getBalance(subAccountAddress);
console.log('Initial subaccount balance:', initialBalance);

// Basic withdrawal using getWithdrawFromSubAccountInstructions
console.log('Performing basic withdrawal (0.1 SOL)...');
try {
  const basicWithdrawIx = await getWithdrawFromSubAccountInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: BigInt(0.1 * LAMPORTS_PER_SOL),
      payer: subAccountAuthority.publicKey,
    },
  );
  await sendTransaction(basicWithdrawIx, subAccountAuthority);

  const balanceAfterBasic = await connection.getBalance(subAccountAddress);
  console.log('Balance after basic withdrawal:', balanceAfterBasic);
} catch (error) {
  console.log('Basic withdrawal failed:', error);
}

await delay(2000);

// Safe withdrawal with validation using checked function
const currentBalance = await connection.getBalance(subAccountAddress);
const withdrawAmount = BigInt(0.5 * LAMPORTS_PER_SOL);

console.log('Performing checked withdrawal (0.5 SOL)...');
try {
  const safeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: withdrawAmount,
      currentBalance: BigInt(currentBalance),
      allowBelowRentExempt: false,
      payer: subAccountAuthority.publicKey,
    },
  );
  await sendTransaction(safeWithdrawIx, subAccountAuthority);

  const balanceAfterSafe = await connection.getBalance(subAccountAddress);
  console.log('Balance after checked withdrawal:', balanceAfterSafe);
} catch (error: any) {
  console.log(
    'Checked withdrawal blocked by safety validation:',
    error instanceof Error ? error.message : String(error),
  );
}

await delay(2000);

// Withdrawal that allows going below rent-exempt (with explicit override)
const balanceAfterSafe = await connection.getBalance(subAccountAddress);
const largeWithdrawAmount =
  BigInt(balanceAfterSafe) - BigInt(0.001 * LAMPORTS_PER_SOL);

console.log('Attempting risky withdrawal with explicit override...');
try {
  const largeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: largeWithdrawAmount,
      currentBalance: BigInt(balanceAfterSafe),
      allowBelowRentExempt: true, // Explicitly allow risky withdrawal
      payer: subAccountAuthority.publicKey,
    },
  );
  await sendTransaction(largeWithdrawIx, subAccountAuthority);

  const finalBalance = await connection.getBalance(subAccountAddress);
  console.log('Final balance after large withdrawal:', finalBalance);
  console.log('Final balance is below rent-exempt:', finalBalance < 1224960);
} catch (error: any) {
  console.log(
    'Large withdrawal failed:',
    error instanceof Error ? error.message : String(error),
  );
}

console.log('Done!');
