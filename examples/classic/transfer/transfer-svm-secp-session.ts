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
  createSecp256k1SessionAuthorityInfo,
  findSwigPda,
  getCreateSessionInstructions,
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
    // console.log('tx:', tx.logs());
  }
}

function fetchSwig(svm: LiteSVM, swigAddress: PublicKey): Swig {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return Swig.fromRawAccountData(swigAddress, swigAccount.data);
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
const dappSessionKeypair = Keypair.generate();
svm.airdrop(dappSessionKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

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

// Example using compressed pubkey with session authority
// createSecp256k1SessionAuthorityInfo now supports both compressed and uncompressed pubkeys
// This demonstrates the new compressed pubkey support for session authorities
const compressedPubkey = compressPubkey(userWallet.getPublicKey());

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1SessionAuthorityInfo(compressedPubkey, 100n),
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

let rootRole = swig.findRoleById(0);

if (!rootRole) throw new Error('Role not found for authority');

const currentSlot = svm.getClock().slot;

const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKeyString(),
);

const instOptions: InstructionDataOptions = { currentSlot, signingFn };

const newSessionInstruction = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  dappSessionKeypair.publicKey,
  50n,
  { ...instOptions, payer: userRootKeypair.publicKey },
);

if (!newSessionInstruction) throw new Error('Session is null');

sendSVMTransaction(svm, newSessionInstruction, userRootKeypair);

swig = fetchSwig(svm, swigAddress);

rootRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey)!;

if (!rootRole) throw new Error('Role not found for authority');

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));

swig = fetchSwig(svm, swigAddress);

console.log('balance before first transfer:', svm.getBalance(swigAddress));

//
// * spend max sol permitted
//
const transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

const signTransfer = await getSignInstructions(
  swig,
  rootRole.id,
  [transfer],
  false,
  {
    ...instOptions,
    payer: dappSessionKeypair.publicKey,
  },
);

sendSVMTransaction(svm, signTransfer, dappSessionKeypair);

console.log('balance after first transfer:', svm.getBalance(swigAddress));
