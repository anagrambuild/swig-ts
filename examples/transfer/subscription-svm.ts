import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  Actions,
  addAuthorityInstruction,
  createEd25519AuthorityInfo,
  findSwigPda,
  signInstruction,
  Swig,
  SWIG_PROGRAM_ADDRESS,
} from '@swig-wallet/classic';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';

function fetchSwig(svm: LiteSVM, swigAddress: PublicKey): ReturnType<typeof Swig.fromRawAccountData> {
  let swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  // Ensure we have a proper Uint8Array for the account data
  const accountData = Uint8Array.from(swigAccount.data);
  return Swig.fromRawAccountData(swigAddress, accountData);
}

// Helper to send transactions through LiteSVM
function sendSVMTransaction(
  svm: LiteSVM,
  instruction: TransactionInstruction,
  payer: Keypair,
): TransactionMetadata | FailedTransactionMetadata {
  svm.expireBlockhash();
  let transaction = new Transaction();
  transaction.instructions = [instruction];
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();
  transaction.sign(payer);
  let tx = svm.sendTransaction(transaction);
  return tx;
}

function printSection(title: string) {
  console.log('\n' + chalk.blue.bold('🔹 ' + title));
}

function printSuccess(message: string) {
  console.log(chalk.green('✓ ' + message));
}

function printError(message: string) {
  console.log(chalk.red('✗ ' + message));
}

function printInfo(message: string) {
  console.log(chalk.cyan('ℹ ' + message));
}

async function main() {
  console.log(chalk.bold.blue('\n🎯 SWIG Subscription Example'));
  console.log(chalk.gray('This example demonstrates how to implement a subscription service using SWIG\n'));

  printSection('Setting up the environment');

  // Initialize LiteSVM with SWIG program
  let swigProgram = Uint8Array.from(readFileSync('../../swig.so'));
  let svm = new LiteSVM();
  svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);
  printSuccess('SWIG program loaded');

  // Create keypairs for different roles
  let rootKeypair = Keypair.generate();
  let subscriptionServiceKeypair = Keypair.generate();
  printSuccess('Generated keypairs for swig root and subscription service');

  // Airdrop SOL to all participants
  printSection('Funding accounts');
  svm.airdrop(rootKeypair.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

  svm.airdrop(subscriptionServiceKeypair.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
  printSuccess('Airdropped 10 SOL to all participants');

  printSection('Creating SWIG wallet');
  // Create SWIG wallet
  let swigId = Uint8Array.from(Array(32).fill(3));
  let [swigAddress] = findSwigPda(swigId);
  
  printInfo(`SWIG wallet address: ${chalk.yellow(swigAddress.toBase58())}`);

  printSection('Configuring SWIG wallet');
  // Create SWIG with root authority
  let rootActions = Actions.set().all().get();
  let createSwigInstruction = Swig.create({
    authorityInfo: createEd25519AuthorityInfo(rootKeypair.publicKey),
    id: swigId,
    payer: rootKeypair.publicKey,
    actions: rootActions,
  });

  let result = sendSVMTransaction(svm, createSwigInstruction, rootKeypair);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error(`Failed to create SWIG wallet: ${result.err}`);
  }
  printSuccess('Created SWIG wallet with root authority');
  svm.airdrop(swigAddress, BigInt(10 * LAMPORTS_PER_SOL));
  // Add subscription service authority with SOL limit
  let swig = await fetchSwig(svm, swigAddress);
  let rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey);
  let rootRole = rootRoles[0];

  printSection('Setting up subscription limits');
  // Set subscription service authority with 0.1 SOL monthly limit
  // 400ms per block, so ~216000 blocks per month
  let subscriptionActions = Actions.set()
    .solRecurringLimit({
      recurringAmount: BigInt(0.1 * LAMPORTS_PER_SOL), // 0.1 SOL
      window: BigInt(216000),
    })
    .get();

  let addSubscriptionAuthorityIx = await addAuthorityInstruction(
    rootRole,
    rootKeypair.publicKey,
    createEd25519AuthorityInfo(subscriptionServiceKeypair.publicKey),
    subscriptionActions,
  );

  result = sendSVMTransaction(svm, addSubscriptionAuthorityIx, rootKeypair);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error(`Failed to add subscription authority: ${result.err}`);
  }
  printSuccess('Added subscription service authority with 0.1 SOL monthly limit');

  printSection('Testing subscription payments');
  // First subscription payment should succeed
  printInfo('Attempting first 0.1 SOL subscription payment...');
  swig = await fetchSwig(svm, swigAddress);
  let transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: subscriptionServiceKeypair.publicKey,
    lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
  });

  let subscriptionRoles = swig.findRolesByEd25519SignerPk(subscriptionServiceKeypair.publicKey);
  let subscriptionRole = subscriptionRoles[0];

  let signTransferIx = await signInstruction(
    subscriptionRole,
    subscriptionServiceKeypair.publicKey,
    [transferIx],
  );

  result = sendSVMTransaction(svm, signTransferIx, subscriptionServiceKeypair);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error(`First payment failed: ${result}`);
  }
  printSuccess('First payment succeeded');

  // Second payment should fail (within same period)
  printInfo('\nAttempting second 0.1 SOL subscription payment immediately...');
  svm.warpToSlot(svm.getClock().slot + BigInt(1));
  transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: subscriptionServiceKeypair.publicKey,
    lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
  });

  signTransferIx = await signInstruction(
    subscriptionRole,
    subscriptionServiceKeypair.publicKey,
    [transferIx],
  );
  
  result = sendSVMTransaction(svm, signTransferIx, subscriptionServiceKeypair);
  if (result instanceof FailedTransactionMetadata) {

    if (result.meta().logs().join('').includes('insufficient funds for instruction')) {
      printSuccess('Second payment failed as expected (monthly limit reached)');
    } else {
      throw new Error(`Unexpected error in second payment: ${result}`);
    }
  } else {
    throw new Error('Second payment unexpectedly succeeded when it should have failed');
  }

  printSection('Testing limit reset');
  // Fast forward one month (216000 blocks)
  printInfo('Fast forwarding one month (216000 blocks)...');
  svm.warpToSlot(svm.getClock().slot + BigInt(216001));
  printSuccess('Time warped forward one month');

  // Third payment should succeed (new period)
  printInfo('\nAttempting third 0.1 SOL subscription payment after one month...');
  transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: subscriptionServiceKeypair.publicKey,
    lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
  });

  signTransferIx = await signInstruction(
    subscriptionRole,
    subscriptionServiceKeypair.publicKey,
    [transferIx],
  );

  result = sendSVMTransaction(svm, signTransferIx, subscriptionServiceKeypair);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error(`Third payment failed: ${result.err()}`);
  }
  printSuccess('Third payment succeeded after limit reset');

  console.log(chalk.bold.green('\n✨ Example completed successfully!'));
  console.log(chalk.gray('This demonstrates how SWIG can be used to implement subscription-based services'));
}

main().catch((error) => {
  console.error(chalk.red('\n❌ Error running example:'));
  console.error(chalk.red(error));
}); 