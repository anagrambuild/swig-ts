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
import { address } from '@solana/kit';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getWithdrawFromSubAccountInstructionContext,
} from '@swig-wallet/kit';
import { readFileSync } from 'node:fs';
import { sleepSync } from 'bun';

function getTransactionMessage<Inst extends IInstruction[]>(
  instructions: Inst,
  lastestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  feePayer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(lastestBlockhash, tx),
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
  const transactionMessage = getTransactionMessage(
    instructions,
    latestBlockhash,
    payer,
    signers,
  );
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  await sendAndConfirmTransactionFactory(connection)(signedTransaction, {
    commitment: 'confirmed',
  });

  const signature = getSignatureFromTransaction(signedTransaction);

  return signature.toString();
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

console.log('starting...');

const connection = {
  rpc: createSolanaRpc('http://localhost:8899'),
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
};

// root authority
const rootAuthority = await generateKeyPairSigner();
await connection.rpc
  .requestAirdrop(rootAuthority.address, lamports(BigInt(LAMPORTS_PER_SOL)))
  .send();

// sub account authority
const subAccountAuthority = await generateKeyPairSigner();
await connection.rpc
  .requestAirdrop(
    subAccountAuthority.address,
    lamports(BigInt(LAMPORTS_PER_SOL)),
  )
  .send();

sleepSync(5000);

const id = randomBytes(32);

const [swigAddress] = await findSwigPda(id);

console.log('swig address:', swigAddress);

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.address,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.address),
  id,
});

await sendTransaction(connection, [createSwigIx], rootAuthority);

sleepSync(5000);

const swig = await fetchSwig(connection.rpc, address(swigAddress));

let rootRole = swig.roles[0];

// add a sub account authority
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.address),
  Actions.set().subAccount().get(),
);
await sendTransaction(connection, addAuthorityIx, rootAuthority);

sleepSync(5000);

await swig.refetch();

let subAccountAuthRole = swig.roles[1];

// create sub account
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
);
await sendTransaction(connection, createSubAccountIx, subAccountAuthority);

sleepSync(5000);

await swig.refetch();

rootRole = swig.roles[0];
subAccountAuthRole = swig.roles[1];

const [subAccountAddress] = await findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);

// fund the sub-account
await connection.rpc
  .requestAirdrop(address(subAccountAddress), lamports(BigInt(2 * LAMPORTS_PER_SOL)))
  .send();

sleepSync(5000);

const initialBalance = (await connection.rpc.getBalance(address(subAccountAddress)).send())
  .value;
console.log('initial sub-account balance:', initialBalance);

// safe withdrawal
const safeWithdrawContext = await getWithdrawFromSubAccountInstructionContext(
  swig,
  subAccountAuthRole.id,
  {
    amount: lamports(BigInt(0.5 * LAMPORTS_PER_SOL)),
    currentBalance: initialBalance,
    allowBelowRentExempt: false,
  }
);
const safeWithdrawIx = safeWithdrawContext.getKitInstructions();
await sendTransaction(connection, safeWithdrawIx, subAccountAuthority);

sleepSync(5000);

const balanceAfterSafe = (await connection.rpc.getBalance(address(subAccountAddress)).send())
  .value;
console.log('balance after safe withdrawal:', balanceAfterSafe);

// withdrawal that would drop below rent-exempt
const largeWithdrawContext = await getWithdrawFromSubAccountInstructionContext(
  swig,
  subAccountAuthRole.id,
  {
    amount: lamports(BigInt(1.5 * LAMPORTS_PER_SOL)),
    currentBalance: balanceAfterSafe,
    allowBelowRentExempt: true,
  }
);
const largeWithdrawIx = largeWithdrawContext.getKitInstructions();
await sendTransaction(connection, largeWithdrawIx, subAccountAuthority);

sleepSync(5000);

const finalBalance = (await connection.rpc.getBalance(address(subAccountAddress)).send())
  .value;
console.log('final balance after allowed withdrawal:', finalBalance);
console.log('final balance is below rent-exempt:', finalBalance < 1224960n);
