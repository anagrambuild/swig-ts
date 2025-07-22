import { p256 } from '@noble/curves/nist';
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
  createSecp256r1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256r1PrivateKey,
  getSignInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
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

const userWallet = p256.keygen();

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
const rootActions = Actions.set().all().get();

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256r1AuthorityInfo(userWallet.publicKey),
  id,
  payer: userRootKeypair.publicKey,
  actions: rootActions,
});

sendSVMTransaction(svm, [createSwigInstruction], userRootKeypair);

//
// * fetch swig
// 
let swig = fetchSwig(svm, swigAddress);

let rootRole = swig.findRolesByAuthoritySigner(
  p256.getPublicKey(userWallet.secretKey, true),
)[0];

if (!rootRole) throw new Error('Role not found for authority');

const signingFn = getSigningFnForSecp256r1PrivateKey(userWallet.secretKey);

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
  {
    payer: userAuthorityManagerKeypair.publicKey,
    signingFn,
    currentSlot: svm.getClock().slot,
  },
);

sendSVMTransaction(svm, signTransfer, userAuthorityManagerKeypair);

console.log('balance after first transfer:', svm.getBalance(swigAddress));
