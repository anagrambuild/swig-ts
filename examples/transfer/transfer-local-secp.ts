import { Wallet } from '@ethereumjs/wallet';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  Actions,
  createSecp256k1AuthorityInfo,
  findSwigPda,
  getSigningFnForSecp256k1PrivateKey,
  signInstruction,
  Swig,
  type InstructionDataOptions,
} from '@swig-wallet/classic';

//
// Helpers
//
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log('starting...');

//
// Connect to localnet
//
const connection = new Connection('http://localhost:8899', 'confirmed');

//
// Create EVM wallet
//
const userWallet = Wallet.generate();

//
// user root
//
const payer = Keypair.generate();
await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);

//
// user authority manager
//
const signer = Keypair.generate();
await connection.requestAirdrop(signer.publicKey, LAMPORTS_PER_SOL);

//
// dapp treasury
//
const dappTreasury = Keypair.generate().publicKey;

await sleep(3000);

//
// * Find a swig pda by id
//
const id = Uint8Array.from(Array(32).fill(1)); // use any 32-byte identifier
const [swigAddress] = findSwigPda(id);

//
// * create swig instruction
//
const rootActions = Actions.set().all().get();

const createSwigInstruction = Swig.create({
  authorityInfo: createSecp256k1AuthorityInfo(userWallet.getPublicKey()),
  id,
  payer: payer.publicKey,
  actions: rootActions,
});

const createSwigTx = new Transaction().add(createSwigInstruction);
await sendAndConfirmTransaction(connection, createSwigTx, [payer]);

//
// * fund the swig pda
//
await connection.requestAirdrop(swigAddress, LAMPORTS_PER_SOL);
await sleep(3000);

//
// * fetch swig
//
const swigAccount = await connection.getAccountInfo(swigAddress);
if (!swigAccount) throw new Error('Swig not created!');
const swig = Swig.fromRawAccountData(swigAddress, swigAccount.data);

//
// * find role by authority
//
const rootRole = swig.findRolesBySecp256k1SignerAddress(
  userWallet.getAddress(),
)[0];
if (!rootRole) throw new Error('Role not found for authority');

//
// * prepare signing context
//
const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKey(),
);
const slot = await connection.getSlot('finalized');
const instOptions: InstructionDataOptions = {
  currentSlot: BigInt(slot),
  signingFn,
};

//
// * spend max sol permitted
//
const lamports = 0.1 * LAMPORTS_PER_SOL;

console.log(
  'balance before first transfer:',
  await connection.getBalance(swigAddress),
);

const transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports,
});

const signedTransfer = await signInstruction(
  rootRole,
  signer.publicKey,
  [transfer],
  instOptions,
);

const tx = new Transaction().add(signedTransfer);
const sig = await sendAndConfirmTransaction(connection, tx, [signer]);

console.log(
  `Transfer sent: https://explorer.solana.com/tx/${sig}?cluster=custom`,
);

console.log(
  'balance after first transfer:',
  await connection.getBalance(swigAddress),
);
