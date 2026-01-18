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
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit';
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
} from '@swig-wallet/kit';

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

const LAMPORTS_PER_SOL = 1_000_000_000n;

// ---------- helpers ----------
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: Rpc<SolanaRpcApi>,
  to: Address,
  amount: bigint,
) {
  const sig = await rpc.requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(2000);
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
  connection: {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  },
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = getTransactionMessage(
    instructions,
    latestBlockhash,
    payer,
    signers,
  );
  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection)(signed, {
    commitment: 'confirmed',
  });

  const sig = getSignatureFromTransaction(signed).toString();
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

// ---------- main ----------
console.log('Starting Kit withdraw subaccount example...');

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const connection = {
  rpc: createSolanaRpc(RPC_URL),
  rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL),
};

// Root authority
const rootAuthority = await generateKeyPairSigner();
await confirmAirdrop(connection.rpc, rootAuthority.address, 1n * LAMPORTS_PER_SOL);

// Sub-account authority
const subAccountAuthority = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  subAccountAuthority.address,
  1n * LAMPORTS_PER_SOL,
);

const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

// Create Swig
console.log('Creating SWIG...');
const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.address,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.address),
  id,
});

await sendTransaction(connection, [createSwigIx], rootAuthority);

const swig = await fetchSwig(connection.rpc, swigAccountAddress);

const rootRole = swig.findRolesByEd25519SignerPk(rootAuthority.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Add sub-account authority
console.log('Adding subaccount authority...');
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.address),
  Actions.set().subAccount().get(),
  { payer: rootAuthority.address },
);

await sendTransaction(connection, addAuthorityIx, rootAuthority);

await swig.refetch();

let subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0];
if (!subAccountAuthRole) throw new Error('Subaccount authority role not found');

// Create sub-account
console.log('Creating subaccount...');
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  { payer: subAccountAuthority.address },
);

await sendTransaction(connection, createSubAccountIx, subAccountAuthority);

await swig.refetch();

subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0]!;

const subAccountAddress = await findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);
console.log('Subaccount address:', subAccountAddress);

// Fund sub-account
await confirmAirdrop(connection.rpc, subAccountAddress, 2n * LAMPORTS_PER_SOL);

const initialBalance = (
  await connection.rpc.getBalance(subAccountAddress).send()
).value;
console.log('Initial subaccount balance:', initialBalance);

// Basic withdrawal using getWithdrawFromSubAccountInstructions
console.log('Performing basic withdrawal (0.1 SOL)...');
try {
  const basicWithdrawIx = await getWithdrawFromSubAccountInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: LAMPORTS_PER_SOL / 10n,
      payer: subAccountAuthority.address,
    },
  );
  await sendTransaction(connection, basicWithdrawIx, subAccountAuthority);

  const balanceAfterBasic = (
    await connection.rpc.getBalance(subAccountAddress).send()
  ).value;
  console.log('Balance after basic withdrawal:', balanceAfterBasic);
} catch (error) {
  console.log('Basic withdrawal failed:', error);
}

// Safe withdrawal with validation using checked function
const currentBalance = (
  await connection.rpc.getBalance(subAccountAddress).send()
).value;
const withdrawAmount = LAMPORTS_PER_SOL / 2n;

console.log('Performing checked withdrawal (0.5 SOL)...');
try {
  const safeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: withdrawAmount,
      currentBalance: currentBalance,
      allowBelowRentExempt: false,
      payer: subAccountAuthority.address,
    },
  );
  await sendTransaction(connection, safeWithdrawIx, subAccountAuthority);

  const balanceAfterSafe = (
    await connection.rpc.getBalance(subAccountAddress).send()
  ).value;
  console.log('Balance after checked withdrawal:', balanceAfterSafe);
} catch (error: any) {
  console.log(
    'Checked withdrawal blocked by safety validation:',
    error instanceof Error ? error.message : String(error),
  );
}

// Withdrawal that allows going below rent-exempt (with explicit override)
const balanceAfterSafe = (
  await connection.rpc.getBalance(subAccountAddress).send()
).value;
const largeWithdrawAmount =
  balanceAfterSafe - BigInt(0.001 * Number(LAMPORTS_PER_SOL));

console.log('Attempting risky withdrawal with explicit override...');
try {
  const largeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: largeWithdrawAmount,
      currentBalance: balanceAfterSafe,
      allowBelowRentExempt: true,
      payer: subAccountAuthority.address,
    },
  );
  await sendTransaction(connection, largeWithdrawIx, subAccountAuthority);

  const finalBalance = (
    await connection.rpc.getBalance(subAccountAddress).send()
  ).value;
  console.log('Final balance after large withdrawal:', finalBalance);
  console.log('Final balance is below rent-exempt:', finalBalance < 1224960n);
} catch (error: any) {
  console.log(
    'Large withdrawal failed:',
    error instanceof Error ? error.message : String(error),
  );
}

console.log('Done!');
