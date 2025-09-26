import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  signTransactionMessageWithSigners,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  addSignersToTransactionMessage,
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
} from '@swig-wallet/kit';

import chalk from 'chalk';

// ---------------- Utils ----------------
const LAMPORTS_PER_SOL = 1_000_000_000n;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint
) {
  const sig = await (rpc as any).requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1200);
}

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
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
  const txMsg = getTransactionMessage(instructions, latestBlockhash, payer, signers);
  const signedTx = await signTransactionMessageWithSigners(txMsg);
  await sendAndConfirmTransactionFactory(connection as any)(signedTx, { commitment: 'confirmed' });
  return getSignatureFromTransaction(signedTx).toString();
}

async function createSwigAccount(connection: any, user: KeyPairSigner) {
  const id = randomBytes(32);
  const swigAddress = await findSwigPda(id);

  // Use manageAuthority only; switch to .all() for full powers.
  const rootActions = Actions.set().manageAuthority().get();
  const authorityInfo = createEd25519AuthorityInfo(user.address);

  const ix = await getCreateSwigInstruction({
    payer: user.address,
    id,
    actions: rootActions,
    authorityInfo,
  });

  const sig = await sendTransaction(connection, [ix], user);

  console.log(chalk.green('✓ Swig account created at:'), chalk.cyan(swigAddress.toString()));
  console.log(chalk.blue('Transaction signature:'), chalk.cyan(sig));

  return { swigAddress, transactionSignature: sig };
}

async function addNewAuthority(
  connection: any,
  rootUser: KeyPairSigner,
  newAuthority: KeyPairSigner,
  swigAddress: Address,
  actions: ReturnType<ReturnType<(typeof Actions)['set']>['get']>,
  description: string,
) {
  const swig = await fetchSwig(connection.rpc, swigAddress);
  const rootRole = swig.findRolesByEd25519SignerPk(rootUser.address)[0];
  if (!rootRole) throw new Error('Root role not found');

  const ix = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(newAuthority.address),
    actions,
    { payer: rootUser.address }, // explicit payer for fees
  );

  await sendTransaction(connection, ix, rootUser);

  console.log(
    chalk.green(`✓ New ${description} authority added:`),
    chalk.cyan(newAuthority.address.toString()),
  );
}

// ---------------- Main ----------------
(async () => {
  console.log(chalk.blue('🚀 Starting tutorial - Swig + Kit style'));

  const connection = {
    rpc: createSolanaRpc('http://localhost:8899'),
    rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
  };

  const rootUser = await generateKeyPairSigner();
  console.log(chalk.green('👤 Root user public key:'), chalk.cyan(rootUser.address.toString()));

  // Airdrop & confirm (100 SOL)
  await confirmAirdrop(connection.rpc, rootUser.address, 100n * LAMPORTS_PER_SOL);

  console.log(chalk.yellow('\n📝 Creating Swig account...'));
  const { swigAddress } = await createSwigAccount(connection, rootUser);

  const spendingAuthority = await generateKeyPairSigner();
  const tokenAuthority = await generateKeyPairSigner();

  console.log(chalk.green('\n👥 Spending authority public key:'), chalk.cyan(spendingAuthority.address.toString()));
  console.log(chalk.green('👥 Token authority public key:'), chalk.cyan(tokenAuthority.address.toString()));

  // Build actions (bigint-only lamports)
  const spendingActions = Actions.set()
    .solLimit({ amount: LAMPORTS_PER_SOL / 10n }) // 0.1 SOL
    .get();

  await addNewAuthority(connection, rootUser, spendingAuthority, swigAddress, spendingActions, 'spending');

  const fakeMint = await generateKeyPairSigner(); // stand-in for a mint pubkey
  const tokenActions = Actions.set()
    .tokenLimit({ mint: fakeMint.address, amount: 1_000_000n }) // e.g., 1.000000 with 6 decimals
    .get();

  await addNewAuthority(connection, rootUser, tokenAuthority, swigAddress, tokenActions, 'token');

  const swig = await fetchSwig(connection.rpc, swigAddress);

  console.log(chalk.blue('\n📊 Authority Permissions:'));

  const spendingRole = swig.findRolesByEd25519SignerPk(spendingAuthority.address)[0];
  if (!spendingRole) throw new Error('Spending role not found');

  console.log(chalk.yellow('Spending Authority:'));
  console.log(
    '- Can spend SOL:',
    chalk.green(spendingRole.actions.canSpendSol(LAMPORTS_PER_SOL / 10n)),
  );
  console.log(
    '- Can spend tokens:',
    chalk.red(spendingRole.actions.canSpendToken(fakeMint.address, 1_000_000n)),
  );

  const tokenRole = swig.findRolesByEd25519SignerPk(tokenAuthority.address)[0];
  if (!tokenRole) throw new Error('Token role not found');

  console.log(chalk.yellow('\nToken Authority:'));
  console.log(
    '- Can spend SOL:',
    chalk.red(tokenRole.actions.canSpendSol(LAMPORTS_PER_SOL / 10n)),
  );
  console.log(
    '- Can spend tokens:',
    chalk.green(tokenRole.actions.canSpendToken(fakeMint.address, 1_000_000n)),
  );

  console.log(chalk.green('\n✨ Tutorial completed successfully!'));
  console.log(chalk.yellow('🔍 View on Solana Explorer:'));
  console.log(
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
