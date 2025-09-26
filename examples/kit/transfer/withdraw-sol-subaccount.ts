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
  getWithdrawFromSubAccountCheckedInstructions,
} from '@swig-wallet/kit';
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

const swigAddress = await findSwigPda(id);

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

const subAccountAddress = await findSwigSubAccountPda(
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

// safe withdrawal with validation using Kit SDK checked function
try {
  console.log('Using Kit SDK checked withdrawal with validation');
  
  const safeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: BigInt(0.5 * LAMPORTS_PER_SOL),
      currentBalance: initialBalance,
      allowBelowRentExempt: false,
    },
  );
  await sendTransaction(connection, safeWithdrawIx, subAccountAuthority);
} catch (error) {
  console.log('Withdrawal blocked by safety validation:', error instanceof Error ? error.message : String(error));
}

sleepSync(5000);

const balanceAfterSafe = (await connection.rpc.getBalance(address(subAccountAddress)).send())
  .value;
console.log('balance after safe withdrawal:', balanceAfterSafe);

// withdrawal that would drop below rent-exempt (with explicit override)
console.log('Attempting risky withdrawal that drops below rent exempt...');

const largeWithdrawAmount = balanceAfterSafe - BigInt(0.001 * LAMPORTS_PER_SOL); // This should leave ~0.001 SOL, below rent-exempt

try {
  // First trying without override (should fail) using Kit SDK
  const blockedWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: largeWithdrawAmount,
      currentBalance: balanceAfterSafe,
      allowBelowRentExempt: false, // Should block this
    },
  );
  console.log('This should not happen - withdrawal should be blocked');
} catch (error) {
  console.log('Withdrawal correctly blocked:', error instanceof Error ? error.message : String(error));
}

try {
  // Trying with explicit override using Kit SDK
  console.log('✅ Trying risky withdrawal with explicit override...');
  
  const largeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: largeWithdrawAmount,
      currentBalance: balanceAfterSafe,
      allowBelowRentExempt: true, // Explicitly allow risky withdrawal
    },
  );
  
  console.log('✅ Risky withdrawal allowed with explicit override');
  await sendTransaction(connection, largeWithdrawIx, subAccountAuthority);
} catch (error) {
  console.log('Large withdrawal failed:', error instanceof Error ? error.message : String(error));
}

sleepSync(5000);

const finalBalance = (await connection.rpc.getBalance(address(subAccountAddress)).send())
  .value;
console.log('final balance after allowed withdrawal:', finalBalance);
console.log('final balance is below rent-exempt:', finalBalance < 1224960n);
