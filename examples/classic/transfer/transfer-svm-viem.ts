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
  getEvmPersonalSignPrefix,
  getSignInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  type SigningFn,
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

const transactionPayer = Keypair.generate();
svm.airdrop(transactionPayer.publicKey, BigInt(LAMPORTS_PER_SOL));

const dappTreasury = Keypair.generate().publicKey;

const id = Uint8Array.from(Array(32).fill(0));

const privateKeyAccount = privateKeyToAccount(userWallet.getPrivateKeyString());

const swigAddress = findSwigPda(id);

const rootActions = Actions.set().all().get();

// Example using compressed pubkey with viem wallet
// createSecp256k1AuthorityInfo now supports both compressed and uncompressed pubkeys
// This demonstrates compressed pubkey support with viem wallets
const compressedPubkey = compressPubkey(privateKeyAccount.publicKey);

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(compressedPubkey),
  id,
  payer: transactionPayer.publicKey,
  actions: rootActions,
});

sendSVMTransaction(svm, [createSwigInstruction], transactionPayer);

//
// * fetch swig
//
// * swig.refetch(connection, ...args) method available
//
let swig = fetchSwig(svm, swigAddress);

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));
// * find role by authority
//
let rootRole = swig.findRolesBySecp256k1SignerAddress(
  privateKeyAccount.address,
)[0];

if (!rootRole) throw new Error('Role not found for authority');

swig = fetchSwig(svm, swigAddress);

console.log('balance before transfers:', svm.getBalance(swigAddress));

const viemSign: SigningFn = async (message: Uint8Array) => {
  const sig = await privateKeyAccount.sign({ hash: keccak256(message) }); // eth_sign

  return { signature: hexToBytes(sig) };
};

//
// * transfer with viem sign
//
const transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

let signTransfer = await getSignInstructions(
  swig,
  rootRole.id,
  [transfer],
  false,
  {
    currentSlot: svm.getClock().slot,
    signingFn: viemSign,
    payer: transactionPayer.publicKey,
  },
);

sendSVMTransaction(svm, signTransfer, transactionPayer);

console.log(
  'balance after transfer with viem Sign, no prefix:',
  svm.getBalance(swigAddress),
);

svm.warpToSlot(100n);

swig = fetchSwig(svm, swigAddress);

rootRole = swig.findRolesBySecp256k1SignerAddress(privateKeyAccount.address)[0];

if (!rootRole) throw new Error('Role not found for authority');

const viemSignWithPrefix: SigningFn = async (message: Uint8Array) => {
  const prefix = getEvmPersonalSignPrefix(message.length);
  const prefixedMessage = new Uint8Array(prefix.length + message.length);

  prefixedMessage.set(prefix);
  prefixedMessage.set(message, prefix.length);

  const sig = await privateKeyAccount.sign({
    hash: keccak256(prefixedMessage),
  }); // eth_sign with personal_sign prefix

  return { signature: hexToBytes(sig), prefix };
};

signTransfer = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  currentSlot: svm.getClock().slot,
  signingFn: viemSignWithPrefix,
  payer: transactionPayer.publicKey,
});

sendSVMTransaction(svm, signTransfer, transactionPayer);

svm.warpToSlot(200n);

swig = fetchSwig(svm, swigAddress);

rootRole = swig.findRolesBySecp256k1SignerAddress(privateKeyAccount.address)[0];

if (!rootRole) throw new Error('Role not found for authority');

const viemSignMessage: SigningFn = async (message: Uint8Array) => {
  const sig = await privateKeyAccount.signMessage({
    message: { raw: message },
  }); // personal_sign

  return {
    signature: hexToBytes(sig),
    prefix: getEvmPersonalSignPrefix(message.length),
  };
};

console.log(
  'balance after transfer with viem Sign with personal-sign prefix:',
  svm.getBalance(swigAddress),
);

signTransfer = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  currentSlot: svm.getClock().slot,
  signingFn: viemSignMessage,
  payer: transactionPayer.publicKey,
});

sendSVMTransaction(svm, signTransfer, transactionPayer);

console.log(
  'balance after transfer with viem SignMessage:',
  svm.getBalance(swigAddress),
);
