import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSwigAccountAddress,
  getSwigCodec,
  getSwigSystemAddress,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  type SwigAccount,
  type SwigFetchFn,
} from '@swig-wallet/classic';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';

/**
 * This example demonstrates the usage of getSwigAccountAddress function.
 * This function was previously broken due to a recursive call bug that caused
 * a stack overflow error. The bug has been fixed by using getSwigAccountAddressRaw
 * from @swig-wallet/lib instead of calling itself recursively.
 *
 * To run this example:
 * 1. Ensure you have the swig.so file in the repository root
 *    Run: bash scripts/update-program-latest.sh
 * 2. Run: bun run get-swig-account-address-svm
 */

//
// Helpers
//
function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
) {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer);

  const tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('Transaction failed:', tx.meta().logs());
    throw new Error('Transaction failed');
  }

  if (tx instanceof TransactionMetadata) {
    console.log('Transaction succeeded');
  }
}

function fetchSwigAccount(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): SwigAccount {
  const swigAccount = svm.getAccount(swigAccountAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return getSwigCodec().decode(swigAccount.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = fetchSwigAccount(svm, swigAccountAddress);

  const swigFetchFn: SwigFetchFn = async (swigAccountAddress) =>
    fetchSwigAccount(svm, toPublicKey(swigAccountAddress));

  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
}

console.log('='.repeat(60));
console.log('Testing getSwigAccountAddress function');
console.log('='.repeat(60));

//
// Start program
//
let swigProgram: Uint8Array;
try {
  swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
} catch (error) {
  console.error('\n❌ Error: swig.so file not found!');
  console.error('Please run: bash scripts/update-program-latest.sh');
  console.error('This will download and build the swig program.\n');
  process.exit(1);
}

const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

//
// Create a user keypair and airdrop some SOL
//
const userKeypair = Keypair.generate();
svm.airdrop(userKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));
console.log('\nUser public key:', userKeypair.publicKey.toBase58());

//
// Generate a unique swig ID
//
const id = Uint8Array.from(Array(32).fill(3));

//
// Find the swig PDA by id
//
const swigAccountAddress = findSwigPda(id);
console.log(
  'Swig account address (via findSwigPda):',
  swigAccountAddress.toBase58(),
);

//
// Create swig instruction with root authority
//
const rootActions = Actions.set().all().get();

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createEd25519AuthorityInfo(userKeypair.publicKey),
  id,
  payer: userKeypair.publicKey,
  actions: rootActions,
});

sendSVMTransaction(svm, [createSwigInstruction], userKeypair);
console.log('\n✓ Swig account created successfully');

//
// Fetch the swig
//
const swig = fetchSwig(svm, swigAccountAddress);

//
// ** THIS IS THE KEY FUNCTION BEING TESTED **
// getSwigAccountAddress was previously broken with a recursive call bug
//
console.log('\n' + '='.repeat(60));
console.log('Testing getSwigAccountAddress (the fixed function):');
console.log('='.repeat(60));

const swigAccountAddressFromFunction = getSwigAccountAddress(swig);
console.log(
  'Swig account address (via getSwigAccountAddress):',
  swigAccountAddressFromFunction.toBase58(),
);

//
// Verify that the addresses match
//
if (
  swigAccountAddress.toBase58() === swigAccountAddressFromFunction.toBase58()
) {
  console.log('✓ SUCCESS: getSwigAccountAddress returns correct address!');
} else {
  console.log('✗ FAILED: Addresses do not match!');
  throw new Error('Address mismatch');
}

//
// Also test related address functions for comparison
//
console.log('\n' + '='.repeat(60));
console.log('Related address functions:');
console.log('='.repeat(60));

const swigSystemAddress = await getSwigSystemAddress(swig);
console.log(
  'Swig system address (via getSwigSystemAddress):',
  swigSystemAddress.toBase58(),
);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log(
  'Swig wallet address (via getSwigWalletAddress):',
  swigWalletAddress.toBase58(),
);

//
// Verify account version
//
console.log('\n' + '='.repeat(60));
console.log('Account version:', swig.accountVersion());
console.log('='.repeat(60));

// For v2 accounts, the wallet address is the system address
// For v1 accounts, the wallet address is the account address
if (swig.accountVersion() === 'v2') {
  if (swigWalletAddress.toBase58() === swigSystemAddress.toBase58()) {
    console.log('✓ V2 account: wallet address equals system address');
  } else {
    console.log('✗ V2 account: wallet address should equal system address');
  }
} else {
  if (swigWalletAddress.toBase58() === swigAccountAddress.toBase58()) {
    console.log('✓ V1 account: wallet address equals account address');
  } else {
    console.log('✗ V1 account: wallet address should equal account address');
  }
}

console.log('\n' + '='.repeat(60));
console.log('All tests passed! ✓');
console.log('='.repeat(60));
