import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  sendAndConfirmTransactionFactory,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  lamports,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  addSignersToTransactionMessage,
  type IInstruction,
  type KeyPairSigner,
  type Blockhash,
} from '@solana/kit';

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
} from '@swig-wallet/kit';

import chalk from 'chalk';

// ---------------------------------------
// Util
// ---------------------------------------
const LAMPORTS_PER_SOL = 1_000_000_000n;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint
) {
  const sig = await (rpc as any).requestAirdrop(to, lamports(amount)).send();
  await (rpc as any).getSignatureStatuses({ signatures: [sig] }).send();
  await delay(1200);
}

function randomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
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
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc.getLatestBlockhash().send();
  const message = getTransactionMessage(instructions, latestBlockhash, payer, signers);
  const signed = await signTransactionMessageWithSigners(message);
  await sendAndConfirmTransactionFactory(connection as any)(signed, { commitment: 'confirmed' });
  return getSignatureFromTransaction(signed).toString();
}

// ---------------------------------------
// Create Swig Account
// ---------------------------------------
async function createSwigAccount(
  connection: {
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  user: KeyPairSigner,
) {
  const id = randomBytes(32);
  const swigAddress = await findSwigPda(id);

  // Use manageAuthority only; switch to Actions.set().all().get() for full access.
  const actions = Actions.set().manageAuthority().get();
  const authorityInfo = createEd25519AuthorityInfo(user.address);

  const ix = await getCreateSwigInstruction({
    payer: user.address,
    id,
    authorityInfo,
    actions,
  });

  const sig = await sendTransaction(connection, [ix], user);

  console.log(chalk.green('✓ Swig account created at:'), chalk.cyan(swigAddress.toString()));
  console.log(chalk.blue('Transaction signature:'), chalk.cyan(sig));
  return swigAddress;
}

// ---------------------------------------
// Main
// ---------------------------------------
(async () => {
  console.log(chalk.blue('🚀 Starting tutorial'));

  const connection = {
    rpc: createSolanaRpc('http://localhost:8899'),
    rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
  };

  const user = await generateKeyPairSigner();

  // Airdrop & confirm
  await confirmAirdrop(connection.rpc, user.address, 100n * LAMPORTS_PER_SOL);

  console.log(chalk.green('👤 User public key:'), chalk.cyan(user.address.toString()));

  const swigAddress = await createSwigAccount(connection, user);

  console.log(chalk.green('\n✨ Everything looks good!'));
  console.log(chalk.yellow('🔍 View on Solana Explorer:'));
  console.log(
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAddress.toString()}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
