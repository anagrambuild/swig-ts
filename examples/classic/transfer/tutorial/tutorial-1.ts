import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

import chalk from 'chalk';

async function createSwigAccount(connection: Connection, user: Keypair) {
  const id = new Uint8Array(32);
  crypto.getRandomValues(id); // random 32-byte id
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
}

(async () => {
  console.log(chalk.blue('🚀 Starting Swig Creation'));

  // connect to local validator
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // generate user root keypair
  const userKeypair = Keypair.generate();
  console.log(
    chalk.green('👤 User public key:'),
    chalk.cyan(userKeypair.publicKey.toBase58()),
  );

  // airdrop lamports for fees + funding
  const sig = await connection.requestAirdrop(
    userKeypair.publicKey,
    10 * LAMPORTS_PER_SOL,
  );
  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: sig,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });
  console.log(chalk.green('💸 Airdropped 10 SOL to user'));

  // create swig
  const swigAddress = await createSwigAccount(connection, userKeypair);

  // fetch swig & wallet
  const swig = await fetchSwig(connection, swigAddress);
  const swigWallet = await getSwigWalletAddress(swig);

  console.log(
    chalk.green('📦 Swig wallet address:'),
    chalk.cyan(swigWallet.toBase58()),
  );

  // airdrop into the swig wallet
  const fundSig = await connection.requestAirdrop(
    swigWallet,
    1 * LAMPORTS_PER_SOL,
  );
  const blockhash2 = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: fundSig,
    blockhash: blockhash2.blockhash,
    lastValidBlockHeight: blockhash2.lastValidBlockHeight,
  });
  console.log(chalk.green('💸 Funded Swig wallet with 1 SOL'));

  // show account version
  const version = swig.accountVersion();
  console.log(
    chalk.blue('📋 Account Version:'),
    chalk.yellow(`Swig ${version.toUpperCase()}`),
  );

  // print root roles (should exist for user)
  const rootRoles = swig.findRolesByEd25519SignerPk(userKeypair.publicKey);
  console.log(
    chalk.magenta('🔑 Root roles found:'),
    rootRoles.map((r) => r.id),
  );

  console.log(chalk.green('\n✨ Everything looks good!'));
  console.log(chalk.yellow('🔍 Check your Swig account on Solana Explorer:'));
  console.log(
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAddress.toBase58()}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
