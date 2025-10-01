import {
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

// ---------- helpers ----------
const LAMPORTS_PER_SOL = 1_000_000_000n;

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendTransaction(
  connection: ReturnType<typeof createConnection>,
  instructions: IInstruction[],
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );

  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection)(signed, {
    commitment: 'confirmed',
  });

  return getSignatureFromTransaction(signed).toString();
}

function createConnection() {
  return {
    rpc: createSolanaRpc('http://localhost:8899'),
    rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
  };
}

async function confirmAirdrop(
  connection: ReturnType<typeof createConnection>,
  to: Address,
  amount: bigint,
) {
  const sig = await connection.rpc.requestAirdrop(to, lamports(amount)).send();
  // give localnet a moment to land the airdrop
  await connection.rpc.getSignatureStatuses([sig]).send();
  await delay(1000);
}

// ---------- main ----------
(async () => {
  const connection = createConnection();

  // Root = SWIG creator/admin
  const rootKeypair = await generateKeyPairSigner();
  await confirmAirdrop(connection, rootKeypair.address, 1n * LAMPORTS_PER_SOL);

  const swigId = randomBytes(32);
  const swigAccountAddress = await findSwigPda(swigId);

  // Create SWIG with full root actions
  const rootActions = Actions.set().all().get();
  const createSwigIx = await getCreateSwigInstruction({
    actions: rootActions,
    id: swigId,
    authorityInfo: createEd25519AuthorityInfo(rootKeypair.address),
    payer: rootKeypair.address,
  });

  await sendTransaction(connection, [createSwigIx], rootKeypair);

  // Fetch SWIG + root role
  const swig = await fetchSwig(connection.rpc, swigAccountAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('📦 Swig wallet address:', swigWalletAddress.toString());

  const rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.address);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  // Define roles using integer percent to avoid float math
  const rolesToCreate: Array<{ name: string; percent: bigint }> = [
    { name: 'data-entry', percent: 5n }, // 0.05 SOL per 1 SOL benchmark
    { name: 'finance', percent: 10n }, // 0.10
    { name: 'developer', percent: 20n }, // 0.20
    { name: 'moderator', percent: 5n }, // 0.05
  ];

  for (const { name, percent } of rolesToCreate) {
    const roleKeypair = await generateKeyPairSigner();

    // Convert percent-of-1-SOL into lamports precisely
    // e.g., 10% => (1 SOL * 10) / 100 = 0.1 SOL
    const amountLamports = (LAMPORTS_PER_SOL * percent) / 100n;

    const actions = Actions.set().solLimit({ amount: amountLamports }).get();

    const addAuthorityIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(roleKeypair.address),
      actions,
      { payer: rootKeypair.address }, // explicit payer is safer
    );

    const sig = await sendTransaction(connection, addAuthorityIx, rootKeypair);
    console.log(
      `[${name}] Added role. Tx: https://explorer.solana.com/tx/${sig}?cluster=custom`,
    );
    console.log(`[${name}] Public Key: ${roleKeypair.address}`);
  }

  console.log('All roles created successfully.');
})();
