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
import { sleepSync } from 'bun';

function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: number;
}) {
  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      {
        address: args.fromAddress,
        role: AccountRole.WRITABLE_SIGNER,
      },
      {
        address: args.toAddress,
        role: AccountRole.WRITABLE,
      },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({
        amount: args.lamports,
      }),
    ),
  };
}

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

// user root
//
const rootAuthority = await generateKeyPairSigner();
await connection.rpc
  .requestAirdrop(rootAuthority.address, lamports(BigInt(LAMPORTS_PER_SOL)))
  .send();

// user authority manager
//
const subAccountAuthority = await generateKeyPairSigner();
await connection.rpc
  .requestAirdrop(
    subAccountAuthority.address,
    lamports(BigInt(LAMPORTS_PER_SOL)),
  )
  .send();

sleepSync(3000);

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

sleepSync(3000);

let swig = await fetchSwig(connection.rpc, swigAddress);

let rootRole = swig.roles[0];

// add a sub account authority
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.address),
  Actions.set().subAccount().get(),
);
await sendTransaction(connection, addAuthorityIx, rootAuthority);

sleepSync(3000);

await swig.refetch();

let subAccountAuthRole = swig.roles[1];

// create sub account
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
);
await sendTransaction(connection, createSubAccountIx, subAccountAuthority);

sleepSync(3000);

await swig.refetch();

rootRole = swig.roles[0];
subAccountAuthRole = swig.roles[1];

const subAccountAddress = await findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);

// svm.airdrop(subAccountAddress, BigInt(LAMPORTS_PER_SOL));

await connection.rpc
  .requestAirdrop(subAccountAddress, lamports(BigInt(LAMPORTS_PER_SOL)))
  .send();

sleepSync(3000);

const subBalance = (await connection.rpc.getBalance(subAccountAddress).send())
  .value;

console.log('sub account balance:', subBalance);

const recipient = (await generateKeyPairSigner()).address;

const transfer = getSolTransferInstruction({
  lamports: 0.1 * LAMPORTS_PER_SOL,
  toAddress: recipient,
  fromAddress: subAccountAddress,
});

const signIx = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer],
  true,
);

await sendTransaction(connection, signIx, subAccountAuthority);

sleepSync(3000);

const newSubBalance = (
  await connection.rpc.getBalance(subAccountAddress).send()
).value;

console.log('new subaccount balance:', newSubBalance);

const recipientBalance = (await connection.rpc.getBalance(recipient).send())
  .value;

console.log('recipient balance:', recipientBalance);
