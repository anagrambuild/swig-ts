import { Wallet } from '@ethereumjs/wallet';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createSecp256k1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getEvmPersonalSignPrefix,
  getSignInstructions,
  getSwigWalletAddress,
  type SigningFn,
} from '@swig-wallet/classic';
import { hexToBytes, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

//
// Helpers
//
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  publicKey: Keypair['publicKey'],
  amount: number = LAMPORTS_PER_SOL,
) {
  const sig = await connection.requestAirdrop(publicKey, amount);
  await connection.confirmTransaction(sig, 'confirmed');
  await delay(2000);
}

async function sendTransaction(
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [],
): Promise<string> {
  const tx = new Transaction().add(...instructions);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer, ...signers], {
    commitment: 'confirmed',
  });
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

console.log('Starting Swig viem transfer on devnet...');
console.log(`Using RPC: ${RPC_URL}`);

//
// Start program
//
const userWallet = Wallet.generate();

const transactionPayer = Keypair.generate();
await confirmAirdrop(transactionPayer.publicKey);

const dappTreasury = Keypair.generate().publicKey;

const id = randomBytes(32);

const privateKeyAccount = privateKeyToAccount(userWallet.getPrivateKeyString());

const swigAddress = findSwigPda(id);

const rootActions = Actions.set().all().get();

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(privateKeyAccount.publicKey),
  id,
  payer: transactionPayer.publicKey,
  actions: rootActions,
});

await sendTransaction([createSwigInstruction], transactionPayer);
await delay(2000);

//
// * fetch swig
//
let swig = await fetchSwig(connection, swigAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);

await confirmAirdrop(swigWalletAddress);

// * find role by authority
//
let rootRole = swig.findRolesBySecp256k1SignerAddress(
  privateKeyAccount.address,
)[0];

if (!rootRole) throw new Error('Role not found for authority');

console.log('balance before transfers:', await connection.getBalance(swigWalletAddress));

const viemSign: SigningFn = async (message: Uint8Array) => {
  const sig = await privateKeyAccount.sign({ hash: keccak256(message) }); // eth_sign

  return { signature: hexToBytes(sig) };
};

//
// * transfer with viem sign
//
const transfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

const currentSlot = await connection.getSlot('finalized');

let signTransfer = await getSignInstructions(
  swig,
  rootRole.id,
  [transfer],
  false,
  {
    currentSlot: BigInt(currentSlot),
    signingFn: viemSign,
    payer: transactionPayer.publicKey,
  },
);

await sendTransaction(signTransfer, transactionPayer);

console.log(
  'balance after transfer with viem Sign, no prefix:',
  await connection.getBalance(swigWalletAddress),
);

// Wait and refetch for fresh slot
await delay(2000);

swig = await fetchSwig(connection, swigAddress);

rootRole = swig.findRolesBySecp256k1SignerAddress(privateKeyAccount.address)[0];

if (!rootRole) throw new Error('Role not found for authority');

const viemSignWithPrefix: SigningFn = async (message: Uint8Array) => {
  const prefix = getEvmPersonalSignPrefix(message.length);
  const prefixedMessage = new Uint8Array(prefix.length + message.length);

  prefixedMessage.set(prefix);
  prefixedMessage.set(message, prefix.length);

  const sig = await privateKeyAccount.sign({ hash: keccak256(prefixedMessage) }); // eth_sign with personal_sign prefix

  return { signature: hexToBytes(sig), prefix };
};

const currentSlot2 = await connection.getSlot('finalized');

signTransfer = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  currentSlot: BigInt(currentSlot2),
  signingFn: viemSignWithPrefix,
  payer: transactionPayer.publicKey,
});

await sendTransaction(signTransfer, transactionPayer);

console.log(
  'balance after transfer with viem Sign with personal-sign prefix:',
  await connection.getBalance(swigWalletAddress),
);

// Wait and refetch for fresh slot
await delay(2000);

swig = await fetchSwig(connection, swigAddress);

rootRole = swig.findRolesBySecp256k1SignerAddress(privateKeyAccount.address)[0];

if (!rootRole) throw new Error('Role not found for authority');

const viemSignMessage: SigningFn = async (message: Uint8Array) => {
  const sig = await privateKeyAccount.signMessage({ message: { raw: message } }); // personal_sign

  return {
    signature: hexToBytes(sig),
    prefix: getEvmPersonalSignPrefix(message.length),
  };
};

const currentSlot3 = await connection.getSlot('finalized');

signTransfer = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  currentSlot: BigInt(currentSlot3),
  signingFn: viemSignMessage,
  payer: transactionPayer.publicKey,
});

await sendTransaction(signTransfer, transactionPayer);

console.log(
  'balance after transfer with viem SignMessage:',
  await connection.getBalance(swigWalletAddress),
);
