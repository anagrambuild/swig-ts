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
console.log('Starting Kit SOL destination limit transfer example...');

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

// Spender (will have destination limit)
const spender = await generateKeyPairSigner();
await confirmAirdrop(connection.rpc, spender.address, 1n * LAMPORTS_PER_SOL);

// Recipients
const authorizedRecipient = await generateKeyPairSigner();
const unauthorizedRecipient = await generateKeyPairSigner();

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
console.log('Authorized recipient:', authorizedRecipient.address);

const rootRole = swig.findRolesByEd25519SignerPk(root.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Fund SWIG wallet
await confirmAirdrop(connection.rpc, swigWalletAddress, 2n * LAMPORTS_PER_SOL);

// Add spender with destination limit
console.log('Adding spender with SOL destination limit...');
const destinationLimit = LAMPORTS_PER_SOL;
const addIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(spender.address),
  Actions.set()
    .solDestinationLimit({
      amount: destinationLimit,
      destination: authorizedRecipient.address,
    })
    .get(),
  { payer: root.address },
);
await sendTransaction(connection, addIx, root);

await swig.refetch();
const spenderRole = swig.findRolesByEd25519SignerPk(spender.address)[0];
if (!spenderRole) throw new Error('Spender role not found');

// Transfer to authorized recipient (should succeed)
console.log('Transferring to authorized recipient...');
const transferAmount = LAMPORTS_PER_SOL / 10n; // 0.1 SOL

const finalizedSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const transfer = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: authorizedRecipient.address,
  lamports: transferAmount,
});

const signIx = await getSignInstructions(swig, spenderRole.id, [transfer], false, {
  payer: spender.address,
  currentSlot: finalizedSlot,
});
await sendTransaction(connection, signIx, spender);

const recipientBalance = (
  await connection.rpc.getBalance(authorizedRecipient.address).send()
).value;
console.log('Authorized recipient balance:', recipientBalance.toString());

// Try transfer to unauthorized recipient (should fail)
console.log('Attempting transfer to unauthorized recipient...');
await swig.refetch();

const newSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const unauthorizedTransfer = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: unauthorizedRecipient.address,
  lamports: transferAmount,
});

try {
  const signIx2 = await getSignInstructions(
    swig,
    spenderRole.id,
    [unauthorizedTransfer],
    false,
    { payer: spender.address, currentSlot: newSlot },
  );
  await sendTransaction(connection, signIx2, spender);
  throw new Error('Transfer to unauthorized recipient should have failed');
} catch (error: any) {
  if (error.message.includes('should have failed')) {
    throw error;
  }
  console.log('Transfer to unauthorized recipient failed as expected');
}

const unauthorizedBalance = (
  await connection.rpc.getBalance(unauthorizedRecipient.address).send()
).value;
console.log(
  'Unauthorized recipient balance:',
  unauthorizedBalance.toString(),
  '(should be 0)',
);

console.log('Done!');
