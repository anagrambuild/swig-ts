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
  addAuthorityInstruction,
  createEd25519AuthorityInfo,
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
import { buffer } from 'node:stream/consumers';

//
// Helpers
//
function sendSVMTransaction(
  svm: LiteSVM,
  instruction: TransactionInstruction,
  payer: Keypair,
) {
  let transaction = new Transaction();
  transaction.instructions = [instruction];
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer);

  let tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx:', tx.meta().logs());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
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
let userAuthorityManagerKeypair = Keypair.generate();
svm.airdrop(userAuthorityManagerKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

// dapp authority
//
let dappAuthorityKeypair = Keypair.generate();
svm.airdrop(dappAuthorityKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

let dappTreasury = Keypair.generate().publicKey;

let id = Uint8Array.from(Array(32).fill(2));

//
// * Find a swig pda by id
//
let [swigAddress] = findSwigPda(id);

console.log("swig address:", swigAddress.toBase58())

//
// * create swig instruction
//
// * createSwig(connection, ...args) imperative method available
//
let rootActions = Actions.set().all().get();

let createSwigInstruction = Swig.create({
  authorityInfo: createEd25519AuthorityInfo(userRootKeypair.publicKey),
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
// * find role by ed25519 signer
//
let rootRoles = swig.findRolesByEd25519SignerPk(userRootKeypair.publicKey);

if (!rootRoles.length) throw new Error('Role not found for authority');

let rootRole = rootRoles[0];

//
// * helper for creating actions
//
let manageAuthorityActions = Actions.set().manageAuthority().get();

//
// * can call instructions associated with a role (or authority)
//
// * role.removeAuthority
// * role.replaceAuthority
// * role.sign
//
let addAuthorityIx = await addAuthorityInstruction(
  rootRole,
  userRootKeypair.publicKey,
  createEd25519AuthorityInfo(userAuthorityManagerKeypair.publicKey),
  manageAuthorityActions,
);

sendSVMTransaction(svm, addAuthorityIx, userRootKeypair);

swig = fetchSwig(svm, swigAddress);

let managerRoles = swig.findRolesByEd25519SignerPk(
  userAuthorityManagerKeypair.publicKey,
);

if (!managerRoles) throw new Error('Role not found for authority');

let managerRole = managerRoles[0];

//
// * perform actions check on a role
//
// * role.hasAllAction
// * role.canSpendSol
// * role.canSpendToken
// * e.t.c
//
if (!managerRole.canManageAuthority())
  throw new Error('Selected role cannot manage authority');

//
// * allocate 0.1 max sol spend, for the dapp
//
let dappAuthorityActions = Actions.set()
  .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
  .get();

//
// * makes the dapp an authority
//
let addDappAuthorityInstruction = await addAuthorityInstruction(
  managerRole,
  userAuthorityManagerKeypair.publicKey,
  createEd25519AuthorityInfo(dappAuthorityKeypair.publicKey),
  dappAuthorityActions,
);

sendSVMTransaction(
  svm,
  addDappAuthorityInstruction,
  userAuthorityManagerKeypair,
);

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));

swig = fetchSwig(svm, swigAddress);

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

let roleIdCanSpendSol = swig.roles
  .filter((role) => role.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)))
  .map((role) => role.id);

//
// * find a role by id
//
let maybeDappRole = swig.findRoleById(roleIdCanSpendSol[1]);
if (!maybeDappRole) throw new Error('Role does not exist');

//
// * check if the authority on a role matches
//
if (
  !maybeDappRole.authority.matchesSigner(
    dappAuthorityKeypair.publicKey.toBytes(),
  )
)
  throw new Error('Role authority is not the authority');

console.log('balance before first transfer:', svm.getBalance(swigAddress));

//
// * spend max sol permitted
//
let transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

let dappAuthorityRoles = swig.findRolesByEd25519SignerPk(
  dappAuthorityKeypair.publicKey,
);

if (!dappAuthorityRoles.length) throw new Error('Role not found for authority');

let dappAuthorityRole = dappAuthorityRoles[0];

let signTransfer = await signInstruction(
  dappAuthorityRole,
  dappAuthorityKeypair.publicKey,
  [transfer],
);

sendSVMTransaction(svm, signTransfer, dappAuthorityKeypair);

console.log('balance after first transfer:', svm.getBalance(swigAddress));

swig = fetchSwig(svm, swigAddress);

//
// * try spend sol
//
transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: dappTreasury,
  lamports: 0.05 * LAMPORTS_PER_SOL,
});

// dappAuthorityRole = swig.findRoleByAuthority(dappAuthority);

// if (!dappAutorityRole) throw new Error('Role not found for authority');

signTransfer = await signInstruction(
  dappAuthorityRole,
  dappAuthorityKeypair.publicKey,
  [transfer],
);

sendSVMTransaction(svm, signTransfer, dappAuthorityKeypair);

console.log('balance after try second transfer:', svm.getBalance(swigAddress));
