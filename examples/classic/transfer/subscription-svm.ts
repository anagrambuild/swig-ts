import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
} from '@swig-wallet/classic';
import chalk from 'chalk';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';

//
// Helpers
//
function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('Swig account not created');
  const accountData = Uint8Array.from(swigAccount.data);
  return Swig.fromRawAccountData(swigAddress, accountData);
}

function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
): TransactionMetadata | FailedTransactionMetadata {
  svm.expireBlockhash();
  const tx = new Transaction();
  tx.instructions = instructions;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);
  return svm.sendTransaction(tx);
}

function printSection(title: string) {
  console.log('\n' + chalk.blue.bold('🔹 ' + title));
}
function printSuccess(msg: string) {
  console.log(chalk.green('✓ ' + msg));
}
function printInfo(msg: string) {
  console.log(chalk.cyan('ℹ ' + msg));
}

//
// Main
//
async function main() {
  console.log(chalk.bold.blue('\n🎯 SWIG Subscription Example'));
  console.log(
    chalk.gray(
      'This example shows how to enforce recurring spend limits (subscriptions) with Swig.\n',
    ),
  );

  // Initialize LiteSVM
  printSection('Environment setup');
  const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
  const svm = new LiteSVM();
  svm.addProgram(new PublicKey(SWIG_PROGRAM_ADDRESS), swigProgram);
  printSuccess('Swig program loaded');

  // Participants
  const rootUser = Keypair.generate();
  const subscriptionService = Keypair.generate();
  printSuccess('Generated root + subscription service keypairs');

  // Fund participants
  printSection('Funding accounts');
  svm.airdrop(rootUser.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
  svm.airdrop(subscriptionService.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
  printSuccess('Airdropped 10 SOL each');

  // Create Swig PDA
  printSection('Creating Swig');
  const swigId = Uint8Array.from(Array(32).fill(3));
  const swigAddress = findSwigPda(swigId);
  printInfo(`Swig PDA: ${chalk.yellow(swigAddress.toBase58())}`);

  const rootActions = Actions.set().all().get();
  const createIx = await getCreateSwigInstruction({
    authorityInfo: createEd25519AuthorityInfo(rootUser.publicKey),
    id: swigId,
    payer: rootUser.publicKey,
    actions: rootActions,
  });

  let result = sendSVMTransaction(svm, [createIx], rootUser);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error('❌ Failed to create Swig wallet');
  }
  printSuccess('Created Swig with root authority');
  svm.airdrop(swigAddress, BigInt(10 * LAMPORTS_PER_SOL));

  // Add subscription service authority with recurring limit
  printSection('Configuring subscription limit');
  let swig = await fetchSwig(svm, swigAddress);
  await swig.refetch();

  const rootRoles = swig.findRolesByEd25519SignerPk(rootUser.publicKey);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  const subscriptionActions = Actions.set()
    .solRecurringLimit({
      recurringAmount: BigInt(0.1 * LAMPORTS_PER_SOL),
      window: BigInt(216_000), // ~1 month in slots
    })
    .get();

  const addIx = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(subscriptionService.publicKey),
    subscriptionActions,
    { payer: rootUser.publicKey },
  );

  result = sendSVMTransaction(svm, addIx, rootUser);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error('❌ Failed to add subscription authority');
  }
  printSuccess('Added subscription authority with 0.1 SOL monthly limit');

  // Test subscription flow
  printSection('Testing subscription payments');
  swig = await fetchSwig(svm, swigAddress);
  await swig.refetch();

  const subRoles = swig.findRolesByEd25519SignerPk(
    subscriptionService.publicKey,
  );
  if (!subRoles.length) throw new Error('Subscription role not found');
  const subRole = subRoles[0];

  // First payment (should succeed)
  printInfo('Attempting first 0.1 SOL payment...');
  let transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: subscriptionService.publicKey,
    lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
  });
  let signIx = await getSignInstructions(swig, subRole.id, [transferIx]);
  result = sendSVMTransaction(svm, signIx, subscriptionService);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error('❌ First payment failed unexpectedly');
  }
  printSuccess('First payment succeeded');

  // Second payment (should fail)
  printInfo('Attempting second 0.1 SOL payment (same period)...');
  svm.warpToSlot(svm.getClock().slot + BigInt(1));
  transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: subscriptionService.publicKey,
    lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
  });
  signIx = await getSignInstructions(swig, subRole.id, [transferIx]);
  result = sendSVMTransaction(svm, signIx, subscriptionService);
  if (result instanceof FailedTransactionMetadata) {
    printSuccess('Second payment failed as expected (limit reached)');
  } else {
    throw new Error('❌ Second payment unexpectedly succeeded');
  }

  // Advance one month
  printSection('Testing reset after one month');
  printInfo('Fast forwarding 216000 slots...');
  svm.warpToSlot(svm.getClock().slot + BigInt(216_001));
  printSuccess('Time warp complete');

  // Third payment (should succeed)
  printInfo('Attempting third payment after reset...');
  transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: subscriptionService.publicKey,
    lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
  });
  signIx = await getSignInstructions(swig, subRole.id, [transferIx]);
  result = sendSVMTransaction(svm, signIx, subscriptionService);
  if (result instanceof FailedTransactionMetadata) {
    throw new Error('❌ Third payment failed after reset');
  }
  printSuccess('Third payment succeeded after reset');

  console.log(chalk.bold.green('\n✨ Subscription example completed!'));
}

main().catch((err) => {
  console.error(chalk.red('\n❌ Error running example:'));
  console.error(err);
});
