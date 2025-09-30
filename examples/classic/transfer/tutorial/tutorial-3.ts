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
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  createTransferInstruction,
  getAccount,
  mintTo,
} from '@solana/spl-token';

import chalk from 'chalk';

//
// Helpers
//
async function createSwigAccount(connection: Connection, user: Keypair) {
  const id = new Uint8Array(32);
  crypto.getRandomValues(id);
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

async function displayTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  label: string,
) {
  const account = await getAccount(connection, tokenAccount);
  console.log(
    chalk.yellow(`${label} token balance:`),
    chalk.cyan(account.amount.toString()),
  );
}

//
// Main
//
(async () => {
  console.log(
    chalk.blue('🚀 Starting tutorial - Token Authority and Transfers'),
  );

  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root user setup
  const rootUser = Keypair.generate();
  console.log(
    chalk.green('👤 Root user:'),
    chalk.cyan(rootUser.publicKey.toBase58()),
  );

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

  // Create swig
  console.log(chalk.yellow('\n📝 Creating Swig account...'));
  const swigAccountAddress = await createSwigAccount(connection, rootUser);
  const swig = await fetchSwig(connection, swigAccountAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log(
    chalk.green('📦 Swig wallet:'),
    chalk.cyan(swigWalletAddress.toBase58()),
  );
  console.log(
    chalk.blue('📋 Version:'),
    chalk.yellow(`Swig ${swig.accountVersion().toUpperCase()}`),
  );

  // Create token mint
  console.log(chalk.yellow('\n💎 Creating token mint...'));
  const mintAuthority = Keypair.generate();
  const tokenMint = await createMint(
    connection,
    rootUser,
    mintAuthority.publicKey,
    null,
    0,
  );
  console.log(chalk.green('✓ Mint:'), chalk.cyan(tokenMint.toBase58()));

  // Create token accounts
  console.log(chalk.yellow('\n💰 Creating token accounts...'));
  const swigTokenAccount = await createAssociatedTokenAccount(
    connection,
    rootUser,
    tokenMint,
    swigWalletAddress,
    {},
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    true,
  );
  console.log(
    chalk.green('✓ Swig token account:'),
    chalk.cyan(swigTokenAccount.toBase58()),
  );

  const recipient = Keypair.generate();
  const recipientTokenAccount = await createAssociatedTokenAccount(
    connection,
    rootUser,
    tokenMint,
    recipient.publicKey,
  );
  console.log(
    chalk.green('✓ Recipient token account:'),
    chalk.cyan(recipientTokenAccount.toBase58()),
  );

  // Mint tokens to Swig
  console.log(chalk.yellow('\n🏦 Minting 10 tokens to Swig...'));
  await mintTo(
    connection,
    rootUser,
    tokenMint,
    swigTokenAccount,
    mintAuthority,
    10,
  );
  await displayTokenBalance(connection, swigTokenAccount, 'Swig');
  await displayTokenBalance(connection, recipientTokenAccount, 'Recipient');

  // Add token authority with limit
  const tokenAuthority = Keypair.generate();
  await connection.requestAirdrop(
    tokenAuthority.publicKey,
    2 * LAMPORTS_PER_SOL,
  );
  console.log(chalk.yellow('\n🔑 Adding token authority...'));
  const tokenActions = Actions.set()
    .tokenLimit({ mint: tokenMint, amount: BigInt(10) })
    .get();
  await addNewAuthority(
    connection,
    rootUser,
    tokenAuthority,
    swigAccountAddress,
    tokenActions,
    'token',
  );

  // Allow state to propagate
  await new Promise((r) => setTimeout(r, 2000));

  //
  // First transfer (should succeed)
  //
  console.log(chalk.yellow('\n💸 First transfer of 10 tokens...'));
  await swig.refetch();
  const tokenRole = swig.findRolesByEd25519SignerPk(
    tokenAuthority.publicKey,
  )[0];
  if (!tokenRole) throw new Error('No role found for token authority');

  const transferIx = createTransferInstruction(
    swigTokenAccount,
    recipientTokenAccount,
    swigWalletAddress, // Swig wallet is the owner
    10n,
  );

  const signedIxs = await getSignInstructions(swig, tokenRole.id, [transferIx]);
  const tx1 = new Transaction().add(...signedIxs);
  await sendAndConfirmTransaction(connection, tx1, [tokenAuthority]);

  console.log(chalk.green('✓ First transfer successful!'));
  await displayTokenBalance(connection, swigTokenAccount, 'Swig');
  await displayTokenBalance(connection, recipientTokenAccount, 'Recipient');

  //
  // Second transfer (should fail, allowance spent)
  //
  console.log(chalk.yellow('\n💸 Second transfer (expected to fail)...'));
  try {
    await swig.refetch();
    const tokenRole2 = swig.findRolesByEd25519SignerPk(
      tokenAuthority.publicKey,
    )[0];

    const transferIx2 = createTransferInstruction(
      swigTokenAccount,
      recipientTokenAccount,
      swigWalletAddress,
      1n,
    );

    const signedIxs2 = await getSignInstructions(swig, tokenRole2.id, [
      transferIx2,
    ]);
    const tx2 = new Transaction().add(...signedIxs2);
    await sendAndConfirmTransaction(connection, tx2, [tokenAuthority], {
      skipPreflight: true,
    });

    console.error(chalk.red('✗ Second transfer unexpectedly succeeded!'));
  } catch {
    console.log(
      chalk.green('✓ Second transfer failed as expected (limit enforced)'),
    );
  }

  await displayTokenBalance(connection, swigTokenAccount, 'Final Swig');
  await displayTokenBalance(
    connection,
    recipientTokenAccount,
    'Final Recipient',
  );

  console.log(chalk.green('\n✨ Tutorial completed successfully!'));
  console.log(chalk.yellow('🔍 Explorer URL:'));
  console.log(
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAccountAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
