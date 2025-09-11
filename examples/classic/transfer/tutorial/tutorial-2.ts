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
} from '@swig-wallet/classic';

import chalk from 'chalk';

async function createSwigAccount(connection: Connection, user: Keypair) {
  try {
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);
    const swigAddress = findSwigPda(id);
    const rootAuthorityInfo = createEd25519AuthorityInfo(user.publicKey);
    const rootActions = Actions.set().all().get();

    const createSwigIx = await getCreateSwigInstruction({
      payer: user.publicKey,
      id,
      actions: rootActions,
      authorityInfo: rootAuthorityInfo,
    });

    const transaction = new Transaction().add(createSwigIx);
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      user,
    ]);

    console.log(
      chalk.green('✓ Swig account created at:'),
      chalk.cyan(swigAddress.toBase58()),
    );
    console.log(chalk.blue('Transaction signature:'), chalk.cyan(signature));
    return swigAddress;
  } catch (error) {
    console.error(
      chalk.red('✗ Error creating Swig account:'),
      chalk.red(error),
    );
    throw error;
  }
}

async function addNewAuthority(
  connection: Connection,
  rootUser: Keypair,
  newAuthority: Keypair,
  swigAddress: PublicKey,
  actions: any,
  description: string,
) {
  try {
    // Fetch the Swig account
    const swig = await fetchSwig(connection, swigAddress);

    // Find the root role that can manage authorities
    const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
    if (!rootRole) {
      throw new Error('Root role not found for authority');
    }

    // Create the instructions to add the new authority
    const addAuthorityInstructions = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(newAuthority.publicKey),
      actions,
    );

    // Send and confirm the transaction
    const transaction = new Transaction().add(...addAuthorityInstructions);
    await sendAndConfirmTransaction(connection, transaction, [rootUser]);
    console.log(
      chalk.green(`✓ New ${description} authority added:`),
      chalk.cyan(newAuthority.publicKey.toBase58()),
    );
  } catch (error) {
    console.error(
      chalk.red(`✗ Error adding ${description} authority:`),
      chalk.red(error),
    );
    throw error;
  }
}

(async () => {
  console.log(chalk.blue('🚀 Starting tutorial - Adding Multiple Authorities'));

  // Connect to local Solana network
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Create and fund the root user
  const rootUser = Keypair.generate();
  console.log(
    chalk.green('👤 Root user public key:'),
    chalk.cyan(rootUser.publicKey.toBase58()),
  );

  const airdrop = await connection.requestAirdrop(
    rootUser.publicKey,
    100 * LAMPORTS_PER_SOL,
  );
  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: airdrop,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });

  // Create the Swig account
  console.log(chalk.yellow('\n📝 Creating Swig account...'));
  const swigAddress = await createSwigAccount(connection, rootUser);

  // Create the spending authority
  const spendingAuthority = Keypair.generate();
  console.log(
    chalk.green('\n👥 Spending authority public key:'),
    chalk.cyan(spendingAuthority.publicKey.toBase58()),
  );

  // Create the token authority
  const tokenAuthority = Keypair.generate();
  console.log(
    chalk.green('👥 Token authority public key:'),
    chalk.cyan(tokenAuthority.publicKey.toBase58()),
  );

  // Add some delay to ensure the Swig account is created
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check account version
  try {
    const swig = await fetchSwig(connection, swigAddress);
    const version = swig.accountVersion();
    console.log(
      chalk.blue('\n📋 Account Version:'),
      chalk.yellow(`Swig ${version.toUpperCase()}`),
    );
  } catch (error) {
    console.error(chalk.red('⚠️ Could not determine account version:'), error);
  }

  // Add spending authority with SOL limit
  console.log(chalk.yellow('\n🔑 Adding spending authority...'));
  const spendingActions = Actions.set()
    .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
    .get();
  await addNewAuthority(
    connection,
    rootUser,
    spendingAuthority,
    swigAddress,
    spendingActions,
    'spending',
  );

  // Add token authority with token management permissions
  console.log(chalk.yellow('\n🔑 Adding token authority...'));
  const tokenMint = Keypair.generate().publicKey; // Example token mint
  const tokenActions = Actions.set()
    .tokenLimit({ mint: tokenMint, amount: BigInt(1000000) })
    .get();
  await addNewAuthority(
    connection,
    rootUser,
    tokenAuthority,
    swigAddress,
    tokenActions,
    'token',
  );

  // Verify the authorities were added
  const swig = await fetchSwig(connection, swigAddress);
  console.log(chalk.blue('\n📊 Authority Permissions:'));

  const spendingRole = swig.findRolesByEd25519SignerPk(
    spendingAuthority.publicKey,
  )[0];
  console.log(chalk.yellow('Spending Authority:'));
  console.log(
    '- Can spend SOL:',
    chalk.green(
      spendingRole.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
    ),
  );
  console.log(
    '- Can spend tokens:',
    chalk.red(spendingRole.actions.canSpendToken(tokenMint, BigInt(1000000))),
  );

  const tokenRole = swig.findRolesByEd25519SignerPk(
    tokenAuthority.publicKey,
  )[0];
  console.log(chalk.yellow('\nToken Authority:'));
  console.log(
    '- Can spend SOL:',
    chalk.red(tokenRole.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL))),
  );
  console.log(
    '- Can spend tokens:',
    chalk.green(tokenRole.actions.canSpendToken(tokenMint, BigInt(1000000))),
  );

  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log(chalk.green('\n✨ Tutorial completed successfully!'));
  console.log(
    chalk.yellow('🔍 Check out your transaction on Solana Explorer:'),
  );
  console.log(
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
