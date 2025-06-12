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
  createEd25519SessionAuthorityInfo,
  createSessionInstruction,
  findSwigPda,
  signInstruction,
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
  instruction: TransactionInstruction,
  payer: Keypair,
  signers: Keypair[] = [],
) {
  let transaction = new Transaction();
  transaction.instructions = [instruction];
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer, ...signers);

  let tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx logs:', tx.meta().logs());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log('tx:', tx.logs());
  }
}

function fetchSwig(svm: LiteSVM, swigAddress: PublicKey): ReturnType<typeof Swig.fromRawAccountData> {
  let swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  // Ensure we have a proper Uint8Array for the account data
  const accountData = Uint8Array.from(swigAccount.data);
  return Swig.fromRawAccountData(swigAddress, accountData);
}

console.log('starting...');
//
// Start program
//
let swigProgram = Uint8Array.from(readFileSync('../../swig.so'));

let svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

// user root
//
let userRootKeypair = Keypair.generate();
svm.airdrop(userRootKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

// user authority manager
//
let dappSessionKeypair = Keypair.generate();
svm.airdrop(dappSessionKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

// dapp authority
//
let dappTreasury = Keypair.generate().publicKey;

let id = Uint8Array.from(Array(32).fill(0));

//
// * Find a swig pda by id
//
let [swigAddress] = findSwigPda(id);

//
// * create swig instruction
//
// * createSwig(connection, ...args) imperative method available
//
let rootActions = Actions.set().all().get();

let createSwigInstruction = Swig.create({
  authorityInfo: createEd25519SessionAuthorityInfo(
    userRootKeypair.publicKey,
    100n,
  ),
  id,
  payer: userRootKeypair.publicKey,
  actions: rootActions,
});

sendSVMTransaction(svm, createSwigInstruction, userRootKeypair);

//
// * fetch swig
//
// * swig.refetch(connection, ...args) method available
//
let swig = fetchSwig(svm, swigAddress);
// swig.refetch(connection)

//
// * find role by id
//
let rootRole = swig.findRoleById(0);

if (!rootRole) throw new Error('Role not found for authority');

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));

let newSessionInstruction = await createSessionInstruction(
  rootRole,
  userRootKeypair.publicKey,
  dappSessionKeypair.publicKey,
  50n,
);

if (!newSessionInstruction) throw new Error('Session is null');

sendSVMTransaction(svm, newSessionInstruction, userRootKeypair);

swig = fetchSwig(svm, swigAddress);

rootRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey);

if (!rootRole || !rootRole.isSessionBased())
  throw new Error('not session based dapp role');

console.log('usrauth key:', dappSessionKeypair.publicKey.toBase58());
console.log('session key:', rootRole.authority.sessionKey.toBase58());
//
// * role array methods (we check what roles can spend sol)
//
console.log(
  'Has ability to spend sol:',
  swig.roles.map((role) => role.canSpendSol()),
);
console.log(
  'Can spend 0.1 sol:',
  swig.roles.map((role) => role.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL))),
);
console.log(
  'Can spend 0.11 sol:',
  swig.roles.map((role) => role.canSpendSol(BigInt(0.11 * LAMPORTS_PER_SOL))),
);

console.log('swig balance before first transfer:', svm.getBalance(swigAddress));
console.log(
  'dapp treasury balance before first transfer:',
  svm.getBalance(dappTreasury),
);

//
// * spend max sol permitted
//
let transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

let signTransfer = await signInstruction(
  rootRole,
  dappSessionKeypair.publicKey,
  [transfer],
);

sendSVMTransaction(svm, signTransfer, dappSessionKeypair);

console.log('swig balance after first transfer:', svm.getBalance(swigAddress));
console.log(
  'dapp treasury balance after first transfer:',
  svm.getBalance(dappTreasury),
);
