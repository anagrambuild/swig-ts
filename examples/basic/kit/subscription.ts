import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
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
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
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

function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: bigint;
}) {
  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      { address: args.fromAddress, role: AccountRole.WRITABLE_SIGNER },
      { address: args.toAddress, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({
        amount: args.lamports,
      }),
    ),
  } satisfies IInstruction;
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
console.log('Starting Kit subscription (recurring limit) example...');

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const connection = {
  rpc: createSolanaRpc(RPC_URL),
  rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL),
};

// Root authority
const root = await generateKeyPairSigner();
await confirmAirdrop(connection.rpc, root.address, 1n * LAMPORTS_PER_SOL);

// Subscription service
const subscriptionService = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  subscriptionService.address,
  1n * LAMPORTS_PER_SOL,
);

const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

// Create SWIG
console.log('Creating SWIG...');
const createSwigIx = await getCreateSwigInstruction({
  payer: root.address,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(root.address),
  id,
});
await sendTransaction(connection, [createSwigIx], root);

const swig = await fetchSwig(connection.rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress);

// Fund swig wallet
await confirmAirdrop(connection.rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);

const rootRole = swig.findRolesByEd25519SignerPk(root.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Add subscription service with recurring limit
console.log('Adding subscription service with 0.1 SOL recurring limit...');
const recurringAmount = LAMPORTS_PER_SOL / 10n; // 0.1 SOL
const windowSlots = 50n; // Small window for testing

const subscriptionActions = Actions.set()
  .solRecurringLimit({
    recurringAmount,
    window: windowSlots,
  })
  .get();

const addSubscriptionIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subscriptionService.address),
  subscriptionActions,
  { payer: root.address },
);

await sendTransaction(connection, addSubscriptionIx, root);

await swig.refetch();
const subRole = swig.findRolesByEd25519SignerPk(subscriptionService.address)[0];
if (!subRole) throw new Error('Subscription role not found');

// First payment (should succeed)
console.log('Attempting first 0.1 SOL payment...');
const finalizedSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const transfer1 = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: subscriptionService.address,
  lamports: recurringAmount,
});

const signIx1 = await getSignInstructions(swig, subRole.id, [transfer1], false, {
  payer: subscriptionService.address,
  currentSlot: finalizedSlot,
});

await sendTransaction(connection, signIx1, subscriptionService);
console.log('First payment succeeded');

// Second payment (should fail - limit reached)
console.log('Attempting second 0.1 SOL payment (same window, should fail)...');
await swig.refetch();

const newSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const transfer2 = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: subscriptionService.address,
  lamports: recurringAmount,
});

const signIx2 = await getSignInstructions(swig, subRole.id, [transfer2], false, {
  payer: subscriptionService.address,
  currentSlot: newSlot,
});

try {
  await sendTransaction(connection, signIx2, subscriptionService);
  throw new Error('Second payment succeeded unexpectedly');
} catch (error: any) {
  if (error.message.includes('succeeded unexpectedly')) {
    throw error;
  }
  console.log('Second payment failed as expected (limit reached)');
}

// Wait for window to reset
console.log(`Waiting for ${windowSlots} slots to elapse...`);
const startSlot = await connection.rpc.getSlot({ commitment: 'finalized' }).send();
const targetSlot = BigInt(startSlot) + windowSlots + 5n;

while (true) {
  await delay(500);
  const currentSlot = await connection.rpc
    .getSlot({ commitment: 'finalized' })
    .send();
  if (BigInt(currentSlot) >= targetSlot) break;
}
console.log('Window elapsed');

// Third payment (should succeed after reset)
console.log('Attempting third 0.1 SOL payment after window reset...');
await swig.refetch();

const resetSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const transfer3 = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: subscriptionService.address,
  lamports: recurringAmount,
});

const signIx3 = await getSignInstructions(swig, subRole.id, [transfer3], false, {
  payer: subscriptionService.address,
  currentSlot: resetSlot,
});

await sendTransaction(connection, signIx3, subscriptionService);
console.log('Third payment succeeded after reset');

console.log('Done!');
