import { Wallet } from '@ethereumjs/wallet';
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
  compressPubkey,
  createSecp256k1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  type InstructionDataOptions,
} from '@swig-wallet/classic';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';

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
    console.log('tx:', tx.meta().logs());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
  }
}

function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  // Ensure we have a proper Uint8Array for the account data
  const accountData = Uint8Array.from(swigAccount.data);
  return Swig.fromRawAccountData(swigAddress, accountData);
}
console.log('starting...');
//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const userWallet = Wallet.generate();

// user root
//
const userRootKeypair = Keypair.generate();
svm.airdrop(userRootKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

// user authority manager
//
const userAuthorityManagerKeypair = Keypair.generate();
svm.airdrop(userAuthorityManagerKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

// dapp authority
//
const dappAuthorityKeypair = Keypair.generate();
svm.airdrop(dappAuthorityKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

const dappTreasury = Keypair.generate().publicKey;

const id = Uint8Array.from(Array(32).fill(0));

//
// * Find a swig pda by id
//
const swigAddress = findSwigPda(id);

//
// * create swig instruction
//
// * createSwig(connection, ...args) imperative method available
//
const rootActions = Actions.set().all().get();

// Example using compressed pubkey instead of uncompressed
// createSecp256k1AuthorityInfo now supports both compressed and uncompressed pubkeys
// This demonstrates the new compressed pubkey support
const compressedPubkey = compressPubkey(userWallet.getPublicKey());

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(compressedPubkey),
  id,
  payer: userRootKeypair.publicKey,
  actions: rootActions,
});

sendSVMTransaction(svm, [createSwigInstruction], userRootKeypair);

//
// * fetch swig
//
// * swig.refetch(connection, ...args) method available
//
let swig = fetchSwig(svm, swigAddress);
// swig.refetch(connection)

// * find role by authority
//
let rootRole = swig.findRolesBySecp256k1SignerAddress(
  userWallet.getAddress(),
)[0];

if (!rootRole) throw new Error('Role not found for authority');

let currentSlot = svm.getClock().slot;

let signingFn = getSigningFnForSecp256k1PrivateKey(userWallet.getPrivateKey());

let instOptions: InstructionDataOptions = { currentSlot, signingFn };

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));

swig = fetchSwig(svm, swigAddress);

console.log('balance before first transfer:', svm.getBalance(swigAddress));

//
// * spend max sol permitted
//
let transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

let signTransfer = await getSignInstructions(
  swig,
  rootRole.id,
  [transfer],
  undefined,
  { ...instOptions, payer: userAuthorityManagerKeypair.publicKey },
);

sendSVMTransaction(svm, signTransfer, userAuthorityManagerKeypair);

console.log('balance after first transfer:', svm.getBalance(swigAddress));

svm.warpToSlot(50n);

//
// * fetch swig
//
// * swig.refetch(connection, ...args) method available
//
swig = fetchSwig(svm, swigAddress);
// swig.refetch(connection)

// * find role by authority
//
rootRole = swig.findRolesBySecp256k1SignerAddress(userWallet.getAddress())[0];

if (!rootRole) throw new Error('Role not found for authority');

currentSlot = svm.getClock().slot;

signingFn = getSigningFnForSecp256k1PrivateKey(userWallet.getPrivateKey());

instOptions = { currentSlot, signingFn };

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));

swig = fetchSwig(svm, swigAddress);

console.log('balance before first transfer:', svm.getBalance(swigAddress));

//
// * spend max sol permitted
//
transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

signTransfer = await getSignInstructions(
  swig,
  rootRole.id,
  [transfer],
  undefined,
  { ...instOptions, payer: userAuthorityManagerKeypair.publicKey },
);

sendSVMTransaction(svm, signTransfer, userAuthorityManagerKeypair);

console.log('balance after first transfer:', svm.getBalance(swigAddress));
