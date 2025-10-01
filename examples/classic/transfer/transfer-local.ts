import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
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
  getSwigWalletAddress,
} from '@swig-wallet/classic';

//
// Helpers
//
async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [],
) {
  const tx = new Transaction().add(...instructions);
  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [payer, ...signers],
    {
      commitment: 'confirmed',
    },
  );
  console.log(
    `🔗 Sent tx: https://explorer.solana.com/tx/${sig}?cluster=custom`,
  );
  return sig;
}

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting example…');

  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root
  const root = Keypair.generate();
  await connection.requestAirdrop(root.publicKey, LAMPORTS_PER_SOL);

  // Manager
  const manager = Keypair.generate();
  await connection.requestAirdrop(manager.publicKey, LAMPORTS_PER_SOL);

  // Dapp
  const dapp = Keypair.generate();
  await connection.requestAirdrop(dapp.publicKey, LAMPORTS_PER_SOL);

  await sleep(2000);

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

  await sendTransaction(connection, [createSwigIx], root);
  await sleep(2000);

  const swig = await fetchSwig(connection, swigAccountAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('swig wallet address:', swigWalletAddress.toBase58());

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

  await sendTransaction(connection, addManagerIx, root);
  await sleep(2000);

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

  await sendTransaction(connection, addDappIx, manager);
  await connection.requestAirdrop(swigWalletAddress, LAMPORTS_PER_SOL);
  await sleep(2000);

  await swig.refetch();
  const dappRole = swig.findRolesByEd25519SignerPk(dapp.publicKey)[0];
  if (!dappRole) throw new Error('Dapp role not found');

  console.log('✅ Roles updated. Checking spend permissions:');
  console.log(
    swig.roles.map((r) => ({
      id: r.id.toString(),
      canSpend01: r.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
      canSpend011: r.actions.canSpendSol(BigInt(0.11 * LAMPORTS_PER_SOL)),
    })),
  );

  // First transfer (should succeed)
  console.log('💸 Attempting first transfer of 0.1 SOL…');
  const transfer1 = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: dapp.publicKey,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });

  const signIx1 = await getSignInstructions(swig, dappRole.id, [transfer1]);
  await sendTransaction(connection, signIx1, dapp);
  await sleep(2000);

  console.log(
    'Swig balance after transfer:',
    await connection.getBalance(swigWalletAddress),
  );

  // Second transfer (should fail)
  console.log('💸 Attempting second transfer (0.05 SOL, should fail)…');
  const transfer2 = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: dapp.publicKey,
    lamports: 0.05 * LAMPORTS_PER_SOL,
  });

  const signIx2 = await getSignInstructions(swig, dappRole.id, [transfer2]);

  try {
    await sendTransaction(connection, signIx2, dapp);
    throw new Error('❌ Second transfer succeeded unexpectedly');
  } catch {
    console.log('✅ Second transfer failed as expected (limit exceeded)');
  }

  console.log(
    'Final Swig balance:',
    await connection.getBalance(swigWalletAddress),
  );
}

main().catch((err) => console.error('❌ Error running script:', err));
