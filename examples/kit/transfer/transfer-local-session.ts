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
  type IInstruction,
  type KeyPairSigner,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit';
import {
  Actions,
  createEd25519SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

const LAMPORTS_PER_SOL = 1_000_000_000n; // bigint

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: Rpc<SolanaRpcApi>,
  to: string,
  amount: bigint,
) {
  const sig = await rpc
    .requestAirdrop(to as unknown as any, lamports(amount))
    .send();
  // Nudge localnet to settle
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1200);
}

console.log('starting...');

const connection = {
  rpc: createSolanaRpc('http://localhost:8899'),
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
};

// User keypair (root authority)
const userRootKeypair = await generateKeyPairSigner();
console.log('Generated root signer:', userRootKeypair.address.toString());
await confirmAirdrop(
  connection.rpc,
  userRootKeypair.address,
  1n * LAMPORTS_PER_SOL,
);

// Session authority
const dappSessionKeypair = await generateKeyPairSigner();
console.log('Generated session signer:', dappSessionKeypair.address.toString());
await confirmAirdrop(
  connection.rpc,
  dappSessionKeypair.address,
  1n * LAMPORTS_PER_SOL,
);

// Treasury destination
const dappTreasury = await generateKeyPairSigner();
console.log('Generated treasury address:', dappTreasury.address.toString());

const id = randomBytes(32);
console.log('Generated Swig ID:', Buffer.from(id).toString('hex'));

const swigAddress = await findSwigPda(id);
console.log('Swig PDA address:', swigAddress.toString());

const rootActions = Actions.set().all().get();

const createSwigIx = await getCreateSwigInstruction({
  id,
  authorityInfo: createEd25519SessionAuthorityInfo(
    userRootKeypair.address,
    100n,
  ), // max session duration (slots) this root can create
  actions: rootActions,
  payer: userRootKeypair.address,
});

console.log('Creating Swig...');
await sendTransaction(connection, [createSwigIx], userRootKeypair);
console.log('Swig created.');

let swig = await fetchSwig(connection.rpc, swigAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress);
console.log('Fetched Swig:', swig.address.toString());

const rootRole = swig.findRoleById(0);
if (!rootRole) throw new Error('Role not found for authority');
console.log('Using root role ID:', rootRole.id);

// Use a finalized slot for session ops
const currentSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const createSessionIx = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  dappSessionKeypair.address,
  50n, // session duration (slots)
  {
    payer: userRootKeypair.address,
    currentSlot, // good hygiene even for Ed25519-root flows
  },
);
console.log('Creating session...');
await sendTransaction(connection, createSessionIx, userRootKeypair);
console.log('Session created for:', dappSessionKeypair.address.toString());

// Fund SWIG wallet
await confirmAirdrop(connection.rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);
await swig.refetch();

console.log(
  'Swig balance after airdrop:',
  (await connection.rpc.getBalance(swigWalletAddress).send()).value,
);

// Capability checks (bigint-safe)
const canSpendAny = swig.roles.map((r) => r.actions.canSpendSol());
const canSpendPoint1 = swig.roles.map((r) =>
  r.actions.canSpendSol(LAMPORTS_PER_SOL / 10n),
);
const canSpendPoint11 = swig.roles.map((r) =>
  r.actions.canSpendSol((LAMPORTS_PER_SOL * 11n) / 100n),
);

console.log('Roles can spend sol:', canSpendAny);
console.log('Roles can spend 0.1 SOL:', canSpendPoint1);
console.log('Roles can spend 0.11 SOL:', canSpendPoint11);

console.log(
  'Swig balance before transfer:',
  (await connection.rpc.getBalance(swigWalletAddress).send()).value,
);
console.log(
  'Treasury balance before transfer:',
  (await connection.rpc.getBalance(dappTreasury.address).send()).value,
);

// Build transfer ix (u64 as bigint)
const transferIx = {
  programAddress: SYSTEM_PROGRAM_ADDRESS,
  accounts: [
    { address: swigWalletAddress, role: AccountRole.WRITABLE_SIGNER },
    { address: dappTreasury.address, role: AccountRole.WRITABLE },
  ],
  data: new Uint8Array(
    getTransferSolInstructionDataEncoder().encode({
      amount: LAMPORTS_PER_SOL / 10n, // 0.1 SOL
    }),
  ),
} satisfies IInstruction;

// Find session role
swig = await fetchSwig(connection.rpc, swigAddress);
const sessionRole = swig.findRolesByEd25519SignerPk(
  dappSessionKeypair.address,
)[0];
if (!sessionRole || !sessionRole.isSessionBased())
  throw new Error('Invalid session role');
console.log('Using session role ID:', sessionRole.id);

// Fresh finalized slot before signing
const signSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

// Sign as the session keypair (no signingFn needed for Ed25519 sessions)
const signedTransferIx = await getSignInstructions(
  swig,
  sessionRole.id,
  [transferIx],
  false,
  { payer: dappSessionKeypair.address, currentSlot: signSlot },
);

console.log('Signing transfer...');
const tx = await sendTransaction(
  connection,
  signedTransferIx,
  dappSessionKeypair,
);
console.log(
  `Transaction submitted: https://explorer.solana.com/tx/${tx}?cluster=custom`,
);

console.log(
  'Swig balance after transfer:',
  (await connection.rpc.getBalance(swigWalletAddress).send()).value,
);
console.log(
  'Treasury balance after transfer:',
  (await connection.rpc.getBalance(dappTreasury.address).send()).value,
);

//
// Transaction helper
//
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

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );

  const signedTx = await signTransactionMessageWithSigners(transactionMessage);
  await sendAndConfirmTransactionFactory(connection)(signedTx, {
    commitment: 'confirmed',
  });
  return getSignatureFromTransaction(signedTx).toString();
}
