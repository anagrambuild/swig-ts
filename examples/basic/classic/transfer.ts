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
console.log('Starting transfer example...');
console.log(`Using RPC: ${RPC_URL}`);

// Create and fund keypairs
const root = Keypair.generate();
const manager = Keypair.generate();
const dapp = Keypair.generate();

await confirmAirdrop(root.publicKey);
await confirmAirdrop(manager.publicKey);
await confirmAirdrop(dapp.publicKey);

// Create Swig
const id = randomBytes(32);
const swigAccountAddress = findSwigPda(id);
const rootActions = Actions.set().all().get();

const createSwigIx = await getCreateSwigInstruction({
  payer: root.publicKey,
  actions: rootActions,
  authorityInfo: createEd25519AuthorityInfo(root.publicKey),
  id,
});

await sendTransaction( [createSwigIx], root);
await delay(2000);

const swig = await fetchSwig(connection, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress.toBase58());

const rootRole = swig.findRolesByEd25519SignerPk(root.publicKey)[0];
if (!rootRole) throw new Error('Root role not found');

// Add Manager
const manageAuthorityActions = Actions.set().manageAuthority().get();
const addManagerIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(manager.publicKey),
  manageAuthorityActions,
);

await sendTransaction( addManagerIx, root);
await delay(2000);

await swig.refetch();
const managerRole = swig.findRolesByEd25519SignerPk(manager.publicKey)[0];
if (!managerRole) throw new Error('Manager role not found');
if (!managerRole.actions.canManageAuthority())
  throw new Error('Manager role cannot manage authorities');

// Add Dapp with 0.1 SOL limit
const dappActions = Actions.set()
  .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
  .get();

const addDappIx = await getAddAuthorityInstructions(
  swig,
  managerRole.id,
  createEd25519AuthorityInfo(dapp.publicKey),
  dappActions,
);

await sendTransaction( addDappIx, manager);

// Fund swig wallet
await confirmAirdrop(swigWalletAddress);
await delay(2000);

await swig.refetch();
const dappRole = swig.findRolesByEd25519SignerPk(dapp.publicKey)[0];
if (!dappRole) throw new Error('Dapp role not found');

console.log('Roles updated. Checking spend permissions:');
console.log(
  swig.roles.map((r) => ({
    id: r.id.toString(),
    canSpend01: r.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
    canSpend011: r.actions.canSpendSol(BigInt(0.11 * LAMPORTS_PER_SOL)),
  })),
);

// First transfer (should succeed)
console.log('Attempting first transfer of 0.1 SOL...');
const transfer1 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dapp.publicKey,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

const signIx1 = await getSignInstructions(swig, dappRole.id, [transfer1]);
await sendTransaction( signIx1, dapp);
await delay(2000);

console.log(
  'Swig balance after transfer:',
  await connection.getBalance(swigWalletAddress),
);

// Second transfer (should fail)
console.log('Attempting second transfer (0.05 SOL, should fail)...');
const transfer2 = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dapp.publicKey,
  lamports: 0.05 * LAMPORTS_PER_SOL,
});

const signIx2 = await getSignInstructions(swig, dappRole.id, [transfer2]);

try {
  await sendTransaction( signIx2, dapp);
  throw new Error('Second transfer succeeded unexpectedly');
} catch {
  console.log('Second transfer failed as expected (limit exceeded)');
}

console.log(
  'Final Swig balance:',
  await connection.getBalance(swigWalletAddress),
);
