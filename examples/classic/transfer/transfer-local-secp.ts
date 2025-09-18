import { Wallet } from '@ethereumjs/wallet';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  Actions,
  createSecp256k1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
  type InstructionDataOptions,
} from '@swig-wallet/classic';
import chalk from 'chalk';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printSuccess(message: string) {
  console.log(chalk.green('✅ ' + message));
}

function printError(message: string) {
  console.log(chalk.red('❌ ' + message));
}

function printInfo(message: string) {
  console.log(chalk.cyan('📌 ' + message));
}

async function main() {
  console.log(chalk.bold.blue('🎯 SWIG Secp256k1 Transfer Example (Localnet)'));
  console.log(
    chalk.gray('Demonstrates SOL transfers using secp256k1 authority\n'),
  );

  // Connect to localnet
  const connection = new Connection('http://localhost:8899', 'confirmed');
  printInfo('Connected to localnet: http://localhost:8899');

  // Create EVM wallet for secp256k1 authority
  const userWallet = Wallet.generate();
  printSuccess(
    `Generated secp256k1 authority: ${userWallet.getAddressString()}`,
  );
  printInfo(
    `Authority pubkey: ${Buffer.from(userWallet.getPublicKey()).toString('hex')}`,
  );

  // Create root user (fee payer)
  const rootUser = Keypair.generate();
  const airdropSig1 = await connection.requestAirdrop(
    rootUser.publicKey,
    LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(airdropSig1);
  printSuccess(
    `Airdropped 1 SOL to root user: ${rootUser.publicKey.toBase58()}`,
  );

  // Create transaction signer
  const transactionSigner = Keypair.generate();
  const airdropSig2 = await connection.requestAirdrop(
    transactionSigner.publicKey,
    LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(airdropSig2);
  printSuccess(
    `Airdropped 1 SOL to transaction signer: ${transactionSigner.publicKey.toBase58()}`,
  );

  // Create recipient address
  const recipient = Keypair.generate().publicKey;
  printInfo(`Recipient address: ${recipient.toBase58()}`);

  await sleep(1000);

  // Create SWIG wallet
  console.log(chalk.blue('\n🔧 Creating SWIG Wallet'));
  const swigId = Uint8Array.from(Array(32).fill(1));
  const swigPda = findSwigPda(swigId);
  printInfo(`SWIG PDA: ${swigPda.toBase58()}`);

  const rootActions = Actions.set().all().get();
  const createSwigInstruction = await getCreateSwigInstruction({
    authorityInfo: createSecp256k1AuthorityInfo(userWallet.getPublicKey()),
    id: swigId,
    payer: rootUser.publicKey,
    actions: rootActions,
  });

  const createSwigTx = new Transaction().add(createSwigInstruction);
  const createSig = await sendAndConfirmTransaction(connection, createSwigTx, [
    rootUser,
  ]);
  printSuccess('Created SWIG wallet with secp256k1 root authority');
  printInfo(
    `Transaction: https://explorer.solana.com/tx/${createSig}?cluster=custom`,
  );

  // Fund the SWIG PDA
  const fundSig = await connection.requestAirdrop(swigPda, LAMPORTS_PER_SOL);
  await connection.confirmTransaction(fundSig);
  printSuccess('Funded SWIG PDA with 1 SOL');

  await sleep(1000);

  // Fetch SWIG account and get wallet address
  console.log(chalk.blue('\n🔍 Fetching SWIG Account'));
  const swig = await fetchSwig(connection, swigPda);
  const swigWalletAddress = getSwigWalletAddress(swig);
  printInfo(`SWIG Wallet Address: ${(await swigWalletAddress).toBase58()}`);
  printSuccess('Fetched SWIG account data');

  // Find role by secp256k1 authority
  console.log(chalk.blue('\n🔑 Finding Authority Role'));
  const roles = swig.findRolesBySecp256k1SignerAddress(userWallet.getAddress());
  if (roles.length === 0) {
    printError('No role found for secp256k1 authority');
    throw new Error('Role not found for authority');
  }
  const rootRole = roles[0];
  printSuccess(`Found role ID: ${rootRole.id}`);
  printInfo(
    `Authority pubkey: ${Buffer.from(userWallet.getPublicKey()).toString('hex')}`,
  );

  // Prepare signing context
  const signingFn = getSigningFnForSecp256k1PrivateKey(
    userWallet.getPrivateKey(),
  );
  const slot = await connection.getSlot('finalized');
  const instOptions: InstructionDataOptions = {
    currentSlot: BigInt(slot),
    signingFn,
  };

  // Perform SOL transfer
  console.log(chalk.blue('\n💸 Performing SOL Transfer'));
  const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
  printInfo(`Transferring ${transferAmount.toString()} lamports (0.1 SOL)`);

  const balanceBefore = await connection.getBalance(swigPda);
  printInfo(`SWIG PDA balance before: ${balanceBefore} lamports`);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: swigPda,
    toPubkey: recipient,
    lamports: transferAmount,
  });

  const signInstructions = await getSignInstructions(
    swig,
    rootRole.id,
    [transferInstruction],
    false,
    { ...instOptions, payer: transactionSigner.publicKey },
  );

  const transferTx = new Transaction().add(...signInstructions);
  const transferSig = await sendAndConfirmTransaction(connection, transferTx, [
    transactionSigner,
  ]);
  printSuccess('Transfer completed successfully');
  printInfo(
    `Transaction: https://explorer.solana.com/tx/${transferSig}?cluster=custom`,
  );

  // Refetch SWIG state after modification
  await swig.refetch();
  printSuccess('Refetched SWIG state');

  const balanceAfter = await connection.getBalance(swigPda);
  printInfo(`SWIG PDA balance after: ${balanceAfter} lamports`);
  printInfo(
    `Transfer cost: ${(balanceBefore - balanceAfter).toString()} lamports`,
  );

  console.log(chalk.bold.green('\n🎉 Example completed successfully!'));
  console.log(
    chalk.gray('Demonstrated secp256k1 authority signing on localnet'),
  );
}

main().catch((error) => {
  console.error(chalk.red('\n❌ Error running example:'));
  console.error(chalk.red(error.message || error));
  process.exit(1);
});
