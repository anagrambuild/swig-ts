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
  createSecp256k1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getEvmPersonalSignPrefix,
  getSignInstructions,
  getSwigCodec,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  type SigningFn,
  type SwigAccount,
  type SwigFetchFn,
} from '@swig-wallet/classic';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';
import { hexToBytes, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

//
// Helpers
//
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

  const res = svm.sendTransaction(tx);
  if (res instanceof FailedTransactionMetadata) {
    console.error('❌ tx failed:', res.meta().logs()?.join('\n'));
  } else {
    console.log('✅ tx success');
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

//
// Main
//
console.log('starting...');

const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const userWallet = Wallet.generate();
const privateKeyAccount = privateKeyToAccount(userWallet.getPrivateKeyString());

const payer = Keypair.generate();
svm.airdrop(payer.publicKey, BigInt(LAMPORTS_PER_SOL));

const dappTreasury = Keypair.generate().publicKey;

const id = Uint8Array.from(Array(32).fill(0));
const swigAccountAddress = findSwigPda(id);

//
// Create Swig
//
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(userWallet.getPublicKey()),
  id,
  payer: payer.publicKey,
  actions: Actions.set().all().get(),
});
sendSVMTransaction(svm, [createSwigIx], payer);

let swig = fetchSwig(svm, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));

let rootRole = swig.findRolesBySecp256k1SignerAddress(
  privateKeyAccount.address,
)[0];
if (!rootRole) throw new Error('Root role not found');

console.log('💰 balance before transfers:', svm.getBalance(swigWalletAddress));

//
// Signing functions
//
const viemSign: SigningFn = async (msg: Uint8Array) => {
  const sig = await privateKeyAccount.sign({ hash: keccak256(msg) }); // eth_sign
  return { signature: hexToBytes(sig) };
};

const viemSignWithPrefix: SigningFn = async (msg: Uint8Array) => {
  const prefix = getEvmPersonalSignPrefix(msg.length);
  const prefixed = new Uint8Array(prefix.length + msg.length);
  prefixed.set(prefix);
  prefixed.set(msg, prefix.length);

  const sig = await privateKeyAccount.sign({ hash: keccak256(prefixed) });
  return { signature: hexToBytes(sig), prefix };
};

const viemSignMessage: SigningFn = async (msg: Uint8Array) => {
  const sig = await privateKeyAccount.signMessage({ message: { raw: msg } }); // personal_sign
  return {
    signature: hexToBytes(sig),
    prefix: getEvmPersonalSignPrefix(msg.length),
  };
};

//
// Shared transfer
//
const lamports = Math.floor(0.1 * LAMPORTS_PER_SOL);
const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports,
});

//
// Case 1: viemSign
//
let signed = await getSignInstructions(swig, rootRole.id, [transferIx], false, {
  currentSlot: svm.getClock().slot,
  signingFn: viemSign,
  payer: payer.publicKey,
});
sendSVMTransaction(svm, signed, payer);
console.log('balance after viemSign:', svm.getBalance(swigWalletAddress));

//
// Case 2: viemSignWithPrefix
//
svm.warpToSlot(100n);
swig = fetchSwig(svm, swigAccountAddress);
rootRole = swig.findRolesBySecp256k1SignerAddress(
  privateKeyAccount.address,
)[0]!;

signed = await getSignInstructions(swig, rootRole.id, [transferIx], false, {
  currentSlot: svm.getClock().slot,
  signingFn: viemSignWithPrefix,
  payer: payer.publicKey,
});
sendSVMTransaction(svm, signed, payer);
console.log(
  'balance after viemSignWithPrefix:',
  svm.getBalance(swigWalletAddress),
);

//
// Case 3: viemSignMessage
//
svm.warpToSlot(200n);
swig = fetchSwig(svm, swigAccountAddress);
rootRole = swig.findRolesBySecp256k1SignerAddress(
  privateKeyAccount.address,
)[0]!;

signed = await getSignInstructions(swig, rootRole.id, [transferIx], false, {
  currentSlot: svm.getClock().slot,
  signingFn: viemSignMessage,
  payer: payer.publicKey,
});
sendSVMTransaction(svm, signed, payer);
console.log(
  'balance after viemSignMessage:',
  svm.getBalance(swigWalletAddress),
);
