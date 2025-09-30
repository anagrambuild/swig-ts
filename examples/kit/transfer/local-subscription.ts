import {
  SYSTEM_PROGRAM_ADDRESS,
  getTransferSolInstructionDataEncoder,
} from '@solana-program/system';
import {
  AccountRole,
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
  type Blockhash,
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
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';
import chalk from 'chalk';

const LAMPORTS_PER_SOL = 1_000_000_000n; // bigint

// -----------------------------
// Helpers
// -----------------------------
function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: bigint; // bigint (u64)
}) {
  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      { address: args.fromAddress, role: AccountRole.WRITABLE_SIGNER },
      { address: args.toAddress, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({ amount: args.lamports }),
    ),
  };
}

function getTransactionMessage<Inst extends IInstruction[]>(
  instructions: Inst,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  feePayer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );
}

async function sendTransaction<T extends IInstruction[]>(
  connection: ReturnType<typeof createConnection>,
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const msg = getTransactionMessage(
    instructions,
    latestBlockhash,
    payer,
    signers,
  );
  const signed = await signTransactionMessageWithSigners(msg);

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

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

async function confirmAirdrop(
  connection: ReturnType<typeof createConnection>,
  to: Address,
  amountLamports: bigint,
) {
  const sig = await connection.rpc
    .requestAirdrop(to, lamports(amountLamports))
    .send();
  // Quick settle; validator speeds vary locally
  await connection.rpc.getSignatureStatuses([sig]).send();
  await new Promise((r) => setTimeout(r, 1200));
}

function section(title: string) {
  console.log('\n' + chalk.blue.bold('🔹 ' + title));
}
function success(msg: string) {
  console.log(chalk.green('✓ ' + msg));
}
function info(msg: string) {
  console.log(chalk.cyan('ℹ ' + msg));
}
function fail(msg: string) {
  console.log(chalk.red('✗ ' + msg));
}

// -----------------------------
// Main
// -----------------------------
console.log(chalk.bold.blue('\n🎯 SWIG Subscription Example (kit)'));
console.log(
  chalk.gray(
    'This example demonstrates a subscription (recurring limit) with SWIG.\n',
  ),
);

const connection = createConnection();

section('Setting up the environment');
const root = await generateKeyPairSigner();
const subscription = await generateKeyPairSigner();
success('Generated keypairs for SWIG root and subscription service');

section('Funding accounts');
await Promise.all([
  confirmAirdrop(connection, root.address, 10n * LAMPORTS_PER_SOL),
  confirmAirdrop(connection, subscription.address, 10n * LAMPORTS_PER_SOL),
]);
success('Airdropped 10 SOL to root & subscription');

section('Creating SWIG wallet');
const swigId = randomBytes(32);
const swigAccountAddress = await findSwigPda(swigId);
info(`SWIG wallet address: ${chalk.yellow(swigAccountAddress)}`);

section('Configuring SWIG wallet');
const createSwigIx = await getCreateSwigInstruction({
  payer: root.address,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(root.address),
  id: swigId,
});
await sendTransaction(connection, [createSwigIx], root);
success('Created SWIG wallet with root authority');

const swig = await fetchSwig(connection.rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
info(`SWIG wallet address: ${chalk.yellow(swigWalletAddress)}`);

await confirmAirdrop(connection, swigWalletAddress, 10n * LAMPORTS_PER_SOL);
success('Funded SWIG wallet with 10 SOL');

const rootRole = swig.findRolesByEd25519SignerPk(root.address)[0];

section('Setting up subscription limits');
// Keep the window small so we can wait it out locally.
const WINDOW_SLOTS = 20n;
const RECURRING_AMOUNT = LAMPORTS_PER_SOL / 10n; // 0.1 SOL as bigint

const recurringActions = Actions.set()
  .solRecurringLimit({
    recurringAmount: RECURRING_AMOUNT,
    window: WINDOW_SLOTS, // slots
  })
  .get();

const addAuthorityIxs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subscription.address),
  recurringActions,
  { payer: root.address }, // explicit payer
);
await sendTransaction(connection, addAuthorityIxs, root);
await swig.refetch();
success('Added subscription authority with 0.1 SOL / window');

section('Testing subscription payments');

async function tryTransfer(label: string, expectedToSucceed = true) {
  info(label);

  const ix = getSolTransferInstruction({
    fromAddress: swigWalletAddress,
    toAddress: subscription.address,
    lamports: RECURRING_AMOUNT, // bigint
  });

  // Refetch before looking up roles to be safe
  await swig.refetch();
  const role = swig.findRolesByEd25519SignerPk(subscription.address)[0];
  const signIxs = await getSignInstructions(swig, role.id, [ix]);

  try {
    await sendTransaction(connection, signIxs, subscription);
    if (expectedToSucceed) {
      success(`${label} succeeded`);
    } else {
      fail(`${label} unexpectedly succeeded`);
    }
  } catch (err: any) {
    if (!expectedToSucceed) {
      success(`${label} failed as expected (limit reached)`);
    } else {
      fail(`${label} failed unexpectedly: ${err?.message ?? err}`);
      throw err;
    }
  }
}

await tryTransfer('First 0.1 SOL payment…'); // should succeed
console.log();
await tryTransfer('Second 0.1 SOL payment (same window)…', false); // should fail

section('Testing limit reset');
// Wait by **slot** count (window + small buffer)
info(`Waiting for ${WINDOW_SLOTS + 5n} finalized slots to elapse…`);
const startSlot = await connection.rpc
  .getSlot({ commitment: 'finalized' })
  .send();
const target = BigInt(startSlot) + WINDOW_SLOTS + 5n;

while (true) {
  await new Promise((r) => setTimeout(r, 500));
  const s = await connection.rpc.getSlot({ commitment: 'finalized' }).send();
  if (BigInt(s) >= target) break;
}
success('Window elapsed');

await tryTransfer('Third 0.1 SOL payment after window reset…'); // should succeed

console.log(chalk.green.bold('\n✨ Example completed successfully!'));
console.log(
  chalk.gray(
    'This demonstrates SWIG-driven recurring spend limits (subscriptions).',
  ),
);
