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
  createSecp256k1SessionAuthorityInfo,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigCodec,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  type InstructionDataOptions,
  type SwigAccount,
  type SwigFetchFn,
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
): TransactionMetadata | FailedTransactionMetadata {
  // Ensure a fresh blockhash for each send
  svm.expireBlockhash();

  const tx = new Transaction();
  tx.instructions = instructions;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);

  const res = svm.sendTransaction(tx);

  if (res instanceof FailedTransactionMetadata) {
    const logs = res.meta().logs() ?? [];
    console.error('❌ Transaction failed. Program logs:\n' + logs.join('\n'));
  } else {
    console.log('✅ Transaction succeeded');
  }
  return res;
}

function fetchSwigAccount(svm: LiteSVM, swigAccountAddress: PublicKey): SwigAccount {
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

console.log('🚀 starting…');

//
// Boot LiteSVM + load Swig program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);
console.log('📦 Swig program loaded into LiteSVM');

//
// Keys / actors
//
const userWallet = Wallet.generate(); // secp256k1 root (session-capable)
const userRootKeypair = Keypair.generate(); // lamport payer for create
const userAuthorityManagerKeypair = Keypair.generate(); // fee payer later
const dappSessionKeypair = Keypair.generate(); // session keypair (ed25519 for tx fee paying)
const dappTreasury = Keypair.generate().publicKey;

svm.airdrop(userRootKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));
svm.airdrop(userAuthorityManagerKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));
svm.airdrop(dappSessionKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

//
// Derive Swig PDA and create Swig with secp256k1 *session* root authority
//
const id = Uint8Array.from(Array(32).fill(0));
const swigAccountAddress = findSwigPda(id);
console.log('📌 Swig PDA:', swigAccountAddress.toBase58());

const rootActions = Actions.set().all().get();
const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1SessionAuthorityInfo(
    userWallet.getPublicKey(),
    100n, // initial root session allowance
  ),
  id,
  payer: userRootKeypair.publicKey,
  actions: rootActions,
});

let res = sendSVMTransaction(svm, [createSwigInstruction], userRootKeypair);
if (res instanceof FailedTransactionMetadata) {
  throw new Error('Failed to create Swig');
}

//
// Fetch swig & locate root role
//
let swig = fetchSwig(svm, swigAccountAddress);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

// Prefer a dedicated finder if available; otherwise, role 0 is root in fresh Swig
const rootRole = swig.findRoleById(0);
if (!rootRole) throw new Error('Root role not found');
console.log('🔑 Root role id:', rootRole.id.toString());

//
// Prepare signing ctx for secp256k1
//
const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKey(),
);
const instOptions: InstructionDataOptions = {
  currentSlot: svm.getClock().slot,
  signingFn,
};

//
// Create a *session role* for the dapp
//
const newSessionIxs = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  dappSessionKeypair.publicKey, // session key
  50n, // session spend limit
  { ...instOptions, payer: userRootKeypair.publicKey },
);
if (!newSessionIxs) throw new Error('Session instruction set not returned');

res = sendSVMTransaction(svm, newSessionIxs, userRootKeypair);
if (res instanceof FailedTransactionMetadata) {
  throw new Error('Failed to create session role');
}

swig = fetchSwig(svm, swigAccountAddress);
await swig.refetch();

const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey);
if (!sessionRole) throw new Error('Session role not found');
console.log('🪪 Session role id:', sessionRole.id?.toString?.() ?? 'undefined');

//
// Fund the Swig PDA and refetch
//
svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));
swig = fetchSwig(svm, swigAccountAddress);
await swig.refetch();

const balanceBeforeTransfer = svm.getBalance(swigWalletAddress);
console.log(
  '💰 Balance before transfer:',
  balanceBeforeTransfer !== null ? balanceBeforeTransfer.toString() : 'null',
);

//
// Execute a SOL transfer signed by the *session role*
//
const lamports = Math.floor(0.1 * LAMPORTS_PER_SOL);
const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports,
});

const signTransferIxs = await getSignInstructions(
  swig,
  sessionRole.id,
  [transferIx],
  false, // do not merge
  {
    ...instOptions,
    payer: dappSessionKeypair.publicKey, // fee payer for the tx
  },
);

res = sendSVMTransaction(svm, signTransferIxs, dappSessionKeypair);
if (res instanceof FailedTransactionMetadata) {
  throw new Error('Signed transfer failed');
}

const balanceAfterTransfer = svm.getBalance(swigWalletAddress);
console.log(
  '💰 Balance after transfer:',
  balanceAfterTransfer !== null ? balanceAfterTransfer.toString() : 'null',
);
