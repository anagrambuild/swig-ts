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
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
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
  await delay(1000);
}

function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: bigint; // bigint u64
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

  return getSignatureFromTransaction(signed).toString();
}

// ---------- main ----------
console.log('starting...');

const connection = {
  rpc: createSolanaRpc('http://localhost:8899'),
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
};

// Root authority
const rootAuthority = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  rootAuthority.address,
  1n * LAMPORTS_PER_SOL,
);

// Sub-account authority manager
const subAccountAuthority = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  subAccountAuthority.address,
  1n * LAMPORTS_PER_SOL,
);

const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('swig address:', swigAccountAddress);

// Create SWIG (root has all actions)
const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.address,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.address),
  id,
});
await sendTransaction(connection, [createSwigIx], rootAuthority);

const swig = await fetchSwig(connection.rpc, swigAccountAddress);

// Resolve root role by signer (safer than indexing)
const rootRole = swig.findRolesByEd25519SignerPk(rootAuthority.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Add an authority that can manage sub-accounts
const addAuthorityIxs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.address),
  Actions.set().subAccount().get(),
  { payer: rootAuthority.address },
);
await sendTransaction(connection, addAuthorityIxs, rootAuthority);

// Refetch to see the new role
await swig.refetch();

let subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0];
if (!subAccountAuthRole)
  throw new Error('Sub-account authority role not found');

// Create a sub-account (payer = subAccountAuthority for clarity)
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  { payer: subAccountAuthority.address },
);
await sendTransaction(connection, createSubAccountIx, subAccountAuthority);

// Refetch and compute sub-account PDA
await swig.refetch();

subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0]!;
const subAccountAddress = await findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);

// Fund sub-account
await confirmAirdrop(connection.rpc, subAccountAddress, 1n * LAMPORTS_PER_SOL);

const subBalance = (await connection.rpc.getBalance(subAccountAddress).send())
  .value;
console.log('sub account balance:', subBalance.toString());

// Prepare a transfer from the sub-account
const recipient = (await generateKeyPairSigner()).address;
const transfer = getSolTransferInstruction({
  lamports: LAMPORTS_PER_SOL / 10n, // 0.1 SOL
  toAddress: recipient,
  fromAddress: subAccountAddress,
});

// Fresh finalized slot is good hygiene even for Ed25519
const signSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

// Sign (from sub-account) and send
const signIx = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer],
  true, // sign from sub-account context
  { payer: subAccountAuthority.address, currentSlot: signSlot },
);

await sendTransaction(connection, signIx, subAccountAuthority);

const newSubBalance = (
  await connection.rpc.getBalance(subAccountAddress).send()
).value;
console.log('new subaccount balance:', newSubBalance.toString());

const recipientBalance = (await connection.rpc.getBalance(recipient).send())
  .value;
console.log('recipient balance:', recipientBalance.toString());
