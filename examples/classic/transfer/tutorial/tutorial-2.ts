import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

import chalk from 'chalk';

async function createSwigAccount(connection: Connection, user: Keypair) {
  const id = new Uint8Array(32);
  crypto.getRandomValues(id); // random id for PDA

  const swigAccountAddress = findSwigPda(id);
  const rootAuthorityInfo = createEd25519AuthorityInfo(user.publicKey);
  const rootActions = Actions.set().all().get();

  const createSwigIx = await getCreateSwigInstruction({
    payer: user.publicKey,
    id,
    actions: rootActions,
    authorityInfo: rootAuthorityInfo,
  });

  const tx = new Transaction().add(createSwigIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [user]);

  console.log(
    chalk.green('✓ Swig account created at:'),
    chalk.cyan(swigAccountAddress.toBase58()),
  );
  console.log(chalk.blue('Transaction signature:'), chalk.cyan(sig));

  return swigAccountAddress;
}

async function addNewAuthority(
  connection: Connection,
  rootUser: Keypair,
  newAuthority: Keypair,
  swigAccountAddress: PublicKey,
  actions: any,
  description: string,
) {
  const swig = await fetchSwig(connection, swigAccountAddress);

  const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
  if (!rootRole) throw new Error('Root role not found for authority');

  const addAuthorityIxs = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(newAuthority.publicKey),
    actions,
  );

  const tx = new Transaction().add(...addAuthorityIxs);
  await sendAndConfirmTransaction(connection, tx, [rootUser]);

  console.log(
    chalk.green(`✓ New ${description} authority added:`),
    chalk.cyan(newAuthority.publicKey.toBase58()),
  );
}

(async () => {
  console.log(chalk.blue('🚀 Starting tutorial - Adding Multiple Authorities'));

  const connection = new Connection('http://localhost:8899', 'confirmed');

  // root user
  const rootUser = Keypair.generate();
  console.log(
    chalk.green('👤 Root user public key:'),
    chalk.cyan(rootUser.publicKey.toBase58()),
  );

  // fund root user
  const sig = await connection.requestAirdrop(
    rootUser.publicKey,
    10 * LAMPORTS_PER_SOL,
  );
  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: sig,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });
  console.log(chalk.green('💸 Airdropped 10 SOL to root user'));

  // create swig
  console.log(chalk.yellow('\n📝 Creating Swig account...'));
  const swigAccountAddress = await createSwigAccount(connection, rootUser);

  // fetch swig + wallet
  const swig = await fetchSwig(connection, swigAccountAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log(
    chalk.green('📦 Swig wallet address:'),
    chalk.cyan(swigWalletAddress.toBase58()),
  );

  // fund swig wallet
  const sig2 = await connection.requestAirdrop(
    swigWalletAddress,
    1 * LAMPORTS_PER_SOL,
  );
  const blockhash2 = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: sig2,
    blockhash: blockhash2.blockhash,
    lastValidBlockHeight: blockhash2.lastValidBlockHeight,
  });
  console.log(chalk.green('💸 Funded Swig wallet with 1 SOL'));

  // check version
  const version = swig.accountVersion();
  console.log(
    chalk.blue('\n📋 Account Version:'),
    chalk.yellow(`Swig ${version.toUpperCase()}`),
  );

  // authorities
  const spendingAuthority = Keypair.generate();
  console.log(
    chalk.green('\n👥 Spending authority public key:'),
    chalk.cyan(spendingAuthority.publicKey.toBase58()),
  );

  const tokenAuthority = Keypair.generate();
  console.log(
    chalk.green('👥 Token authority public key:'),
    chalk.cyan(tokenAuthority.publicKey.toBase58()),
  );

  // add spending authority with 0.1 SOL limit
  console.log(chalk.yellow('\n🔑 Adding spending authority...'));
  const spendingActions = Actions.set()
    .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
    .get();
  await addNewAuthority(
    connection,
    rootUser,
    spendingAuthority,
    swigAccountAddress,
    spendingActions,
    'spending',
  );

  // add token authority with 1,000,000 token limit (example mint)
  console.log(chalk.yellow('\n🔑 Adding token authority...'));
  const tokenMint = Keypair.generate().publicKey; // mock mint
  const tokenActions = Actions.set()
    .tokenLimit({ mint: tokenMint, amount: BigInt(1_000_000) })
    .get();
  await addNewAuthority(
    connection,
    rootUser,
    tokenAuthority,
    swigAccountAddress,
    tokenActions,
    'token',
  );

  // verify roles
  const updatedSwig = await fetchSwig(connection, swigAccountAddress);
  console.log(chalk.blue('\n📊 Authority Permissions:'));

  const spendingRole = updatedSwig.findRolesByEd25519SignerPk(
    spendingAuthority.publicKey,
  )[0];
  console.log(chalk.yellow('Spending Authority:'));
  console.log(
    '- Can spend SOL (0.1):',
    spendingRole.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
  );
  console.log(
    '- Can spend tokens:',
    spendingRole.actions.canSpendToken(tokenMint, BigInt(1000)),
  );

  const tokenRole = updatedSwig.findRolesByEd25519SignerPk(
    tokenAuthority.publicKey,
  )[0];
  console.log(chalk.yellow('\nToken Authority:'));
  console.log(
    '- Can spend SOL:',
    tokenRole.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
  );
  console.log(
    '- Can spend tokens (1,000,000):',
    tokenRole.actions.canSpendToken(tokenMint, BigInt(1_000_000)),
  );

  console.log(chalk.green('\n✨ Tutorial completed successfully!'));
  console.log(chalk.yellow('🔍 Check it out on Solana Explorer:'));
  console.log(
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAccountAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
