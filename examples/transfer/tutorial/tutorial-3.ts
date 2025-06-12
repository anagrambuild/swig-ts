import {
  Keypair,
  LAMPORTS_PER_SOL,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from '@solana/web3.js';

import {
  Actions,
  createSwig,
  Ed25519Authority,
  findSwigPda,
  addAuthorityInstruction,
  fetchSwig,
  createEd25519AuthorityInfo,
  signInstruction,
} from "@swig-wallet/classic";

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
} from "@solana/spl-token";

import chalk from 'chalk';

async function createSwigAccount(
  connection: Connection,
  user: Keypair,
) {
  try {
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);
    const [swigAddress] = findSwigPda(id);
    const rootAuthority = Ed25519Authority.fromPublicKey(user.publicKey);
    const rootActions = Actions.set().manageAuthority().get();
    const tx = await createSwig(
      connection,
      id,
      rootAuthority,
      rootActions,
      user.publicKey,
      [user]
    );

    console.log(chalk.green("✓ Swig account created at:"), chalk.cyan(swigAddress.toBase58()));
    return swigAddress;
  } catch (error) {
    console.error(chalk.red("✗ Error creating Swig account:"), chalk.red(error));
    throw error;
  }
}

async function addNewAuthority(
  connection: Connection,
  rootUser: Keypair,
  newAuthority: Keypair,
  swigAddress: PublicKey,
  actions: any,
  description: string
) {
  try {
    const swig = await fetchSwig(connection, swigAddress);
    const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
    if (!rootRole) {
      throw new Error('Root role not found for authority');
    }

    const addAuthorityIx = await addAuthorityInstruction(
      rootRole,
      rootUser.publicKey,
      createEd25519AuthorityInfo(newAuthority.publicKey),
      actions,
    );

    const transaction = new Transaction().add(addAuthorityIx);
    await sendAndConfirmTransaction(connection, transaction, [rootUser]);
    console.log(chalk.green(`✓ New ${description} authority added:`), chalk.cyan(newAuthority.publicKey.toBase58()));
  } catch (error) {
    console.error(chalk.red(`✗ Error adding ${description} authority:`), chalk.red(error));
    throw error;
  }
}

async function displayTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  label: string
) {
  const account = await getAccount(connection, tokenAccount);
  console.log(chalk.yellow(`${label} token balance:`), chalk.cyan(account.amount.toString()));
}

(async () => {
  console.log(chalk.blue("🚀 Starting tutorial - Token Authority and Transfers"));

  // Connect to local Solana network
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Create and fund the root user
  const rootUser = Keypair.generate();
  console.log(chalk.green("👤 Root user public key:"), chalk.cyan(rootUser.publicKey.toBase58()));

  let airdrop = await connection.requestAirdrop(rootUser.publicKey, 100 * LAMPORTS_PER_SOL);
  let blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: airdrop,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });

  // Create the Swig account
  console.log(chalk.yellow("\n📝 Creating Swig account..."));
  const swigAddress = await createSwigAccount(connection, rootUser);

  // Create token mint
  console.log(chalk.yellow("\n💎 Creating token mint..."));
  const mintAuthority = Keypair.generate();
  const tokenMint = await createMint(
    connection,
    rootUser,
    mintAuthority.publicKey,
    null,
    0
  );
  console.log(chalk.green("✓ Token mint created:"), chalk.cyan(tokenMint.toBase58()));

  // Create token accounts
  console.log(chalk.yellow("\n💰 Creating token accounts..."));
  const swigTokenAccount = await createAssociatedTokenAccount(
    connection,
    rootUser,
    tokenMint,
    swigAddress,
    {},
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    true
  );
  console.log(chalk.green("✓ Swig token account created:"), chalk.cyan(swigTokenAccount.toBase58()));

  const recipientKeypair = Keypair.generate();
  const recipientTokenAccount = await createAssociatedTokenAccount(
    connection,
    rootUser,
    tokenMint,
    recipientKeypair.publicKey
  );
  console.log(chalk.green("✓ Recipient token account created:"), chalk.cyan(recipientTokenAccount.toBase58()));

  // Mint initial tokens to Swig account
  console.log(chalk.yellow("\n🏦 Minting tokens to Swig account..."));
  await mintTo(
    connection,
    rootUser,
    tokenMint,
    swigTokenAccount,
    mintAuthority,
    10
  );
  await displayTokenBalance(connection, swigTokenAccount, "Swig");
  await displayTokenBalance(connection, recipientTokenAccount, "Recipient");

  // Create token authority with permission to send exactly 10 tokens
  const tokenAuthority = Keypair.generate();
  console.log(chalk.green("\n👥 Token authority public key:"), chalk.cyan(tokenAuthority.publicKey.toBase58()));
  await connection.requestAirdrop(tokenAuthority.publicKey, 100 * LAMPORTS_PER_SOL);
  console.log(chalk.yellow("\n🔑 Adding token authority..."));
  const tokenActions = Actions.set()
    .tokenLimit({ mint: tokenMint, amount: BigInt(10) })
    .get();
  await addNewAuthority(connection, rootUser, tokenAuthority, swigAddress, tokenActions, "token");

  // Add some delay to ensure the authority is added
  await new Promise(resolve => setTimeout(resolve, 2000));

  // First transfer - should succeed
  console.log(chalk.yellow("\n💸 Attempting first transfer of 10 tokens..."));
  try {
    const swig = await fetchSwig(connection, swigAddress);
    const tokenRole = swig.findRolesByEd25519SignerPk(tokenAuthority.publicKey)[0];

    const transferIx = createTransferInstruction(
      swigTokenAccount,
      recipientTokenAccount,
      swigAddress,
      BigInt(10)
    );

    const signedTransfer = await signInstruction(
      tokenRole,
      tokenAuthority.publicKey,
      [transferIx]
    );

    const transaction = new Transaction().add(signedTransfer);
    await sendAndConfirmTransaction(connection, transaction, [tokenAuthority]);
    console.log(chalk.green("✓ First transfer successful!"));
    await displayTokenBalance(connection, swigTokenAccount, "Swig");
    await displayTokenBalance(connection, recipientTokenAccount, "Recipient");
  } catch (error) {
    console.error(chalk.red("✗ First transfer failed:"), chalk.red(error));
  }

  // Second transfer - should fail
  console.log(chalk.yellow("\n💸 Attempting second transfer (should fail)..."));
  try {
    const swig = await fetchSwig(connection, swigAddress);
    const tokenRole = swig.findRolesByEd25519SignerPk(tokenAuthority.publicKey)[0];

    const transferIx = createTransferInstruction(
      swigTokenAccount,
      recipientTokenAccount,
      swigAddress,
      BigInt(10)
    );

    const signedTransfer = await signInstruction(
      tokenRole,
      tokenAuthority.publicKey,
      [transferIx]
    );

    const transaction = new Transaction().add(signedTransfer);
    await sendAndConfirmTransaction(connection, transaction, [tokenAuthority], {
      skipPreflight: true,
    });
    console.error(chalk.red("✗ Second transfer unexpectedly succeeded!"));
  } catch (error) {
    console.log(chalk.green("✓ Second transfer failed as expected:"), "Authority has no remaining token allowance");
  }

  await displayTokenBalance(connection, swigTokenAccount, "Final Swig");
  await displayTokenBalance(connection, recipientTokenAccount, "Final Recipient");

  console.log(chalk.green("\n✨ Tutorial completed successfully!"));
  console.log(chalk.yellow("🔍 Check out your transaction on Solana Explorer:"));
  console.log(chalk.cyan(`https://explorer.solana.com/address/${swigAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`));
})();
