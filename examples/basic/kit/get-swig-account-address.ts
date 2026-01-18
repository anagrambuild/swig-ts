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
  getCreateSwigInstruction,
  getSwigAccountAddress,
  getSwigSystemAddress,
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
console.log('Starting Kit get-swig-account-address example...');

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const connection = {
  rpc: createSolanaRpc(RPC_URL),
  rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL),
};

// Create and fund keypair
const user = await generateKeyPairSigner();
await confirmAirdrop(connection.rpc, user.address, 1n * LAMPORTS_PER_SOL);
console.log('User address:', user.address);

// Generate a unique swig ID
const id = randomBytes(32);

// Find the swig PDA by id
const swigAccountAddress = await findSwigPda(id);
console.log('Swig account address (via findSwigPda):', swigAccountAddress);

// Create swig with root authority
console.log('Creating SWIG...');
const rootActions = Actions.set().all().get();

const createSwigIx = await getCreateSwigInstruction({
  payer: user.address,
  actions: rootActions,
  authorityInfo: createEd25519AuthorityInfo(user.address),
  id,
});

await sendTransaction(connection, [createSwigIx], user);

// Fetch the swig
const swig = await fetchSwig(connection.rpc, swigAccountAddress);

// Test getSwigAccountAddress
console.log('\nTesting address functions:');
console.log('='.repeat(50));

const accountAddress = getSwigAccountAddress(swig);
console.log('getSwigAccountAddress:', accountAddress);

// Verify addresses match
if (swigAccountAddress === accountAddress) {
  console.log('✓ getSwigAccountAddress matches findSwigPda');
} else {
  throw new Error('Address mismatch!');
}

// Test getSwigSystemAddress
const systemAddress = await getSwigSystemAddress(swig);
console.log('getSwigSystemAddress:', systemAddress);

// Test getSwigWalletAddress
const walletAddress = await getSwigWalletAddress(swig);
console.log('getSwigWalletAddress:', walletAddress);

// Verify wallet address based on account version
console.log('\nAccount version:', swig.accountVersion());

if (swig.accountVersion() === 'v2') {
  if (walletAddress === systemAddress) {
    console.log('✓ V2 account: wallet address equals system address');
  } else {
    throw new Error('V2 account: wallet address should equal system address');
  }
} else {
  if (walletAddress === accountAddress) {
    console.log('✓ V1 account: wallet address equals account address');
  } else {
    throw new Error('V1 account: wallet address should equal account address');
  }
}

console.log('\nDone!');
