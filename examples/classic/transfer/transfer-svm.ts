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
  createEd25519AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigCodec,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
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

function fetchSwigAccount(svm: LiteSVM, swigAddress: PublicKey): SwigAccount {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  // Ensure we have a proper Uint8Array for the account data
  return getSwigCodec().decode(swigAccount.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = fetchSwigAccount(svm, swigAddress);

  const swigFetchFn: SwigFetchFn = async (swigAddress) =>
    fetchSwigAccount(svm, toPublicKey(swigAddress));

  return new Swig(swigAddress, swigAccount, swigFetchFn);
}

console.log('starting...');
//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

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

const id = Uint8Array.from(Array(32).fill(2));

//
// * Find a swig pda by id
//
const swigAccountAddress = findSwigPda(id);

console.log('swig account address:', swigAccountAddress.toBase58());

//
// * create swig instruction
//
// * createSwig(connection, ...args) imperative method available
//
const rootActions = Actions.set().all().get();

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createEd25519AuthorityInfo(userRootKeypair.publicKey),
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
const swig = fetchSwig(svm, swigAccountAddress);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

//
// * find role by ed25519 signer
//
const rootRoles = swig.findRolesByEd25519SignerPk(userRootKeypair.publicKey);

if (!rootRoles.length) throw new Error('Role not found for authority');

const rootRole = rootRoles[0];

//
// * helper for creating actions
//
const manageAuthorityActions = Actions.set().manageAuthority().get();

//
// * can call instructions associated with a role (or authority)
//
// * role.removeAuthority
// * role.replaceAuthority
// * role.sign
//
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(userAuthorityManagerKeypair.publicKey),
  manageAuthorityActions,
);

sendSVMTransaction(svm, addAuthorityIx, userRootKeypair);

await swig.refetch();

const managerRoles = swig.findRolesByEd25519SignerPk(
  userAuthorityManagerKeypair.publicKey,
);

if (!managerRoles) throw new Error('Role not found for authority');

const managerRole = managerRoles[0];

//
// * perform actions check on a role
//
// * role.hasAllAction
// * role.canSpendSol
// * role.canSpendToken
// * e.t.c
//
if (!managerRole.actions.canManageAuthority())
  throw new Error('Selected role cannot manage authority');

//
// * allocate 0.1 max sol spend, for the dapp
//
const dappAuthorityActions = Actions.set()
  .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
  .get();

//
// * makes the dapp an authority
//
const addDappAuthorityInstruction = await getAddAuthorityInstructions(
  swig,
  managerRole.id,
  createEd25519AuthorityInfo(dappAuthorityKeypair.publicKey),
  dappAuthorityActions,
);

sendSVMTransaction(
  svm,
  addDappAuthorityInstruction,
  userAuthorityManagerKeypair,
);

svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));

await swig.refetch();

//
// * role array methods (we check what roles can spend sol)
//
console.log(
  'Has ability to spend sol:',
  swig.roles.map((role) => role.actions.canSpendSol()),
);
console.log(
  'Can spend 0.1 sol:',
  swig.roles.map((role) =>
    role.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
  ),
);
console.log(
  'Can spend 0.11 sol:',
  swig.roles.map((role) =>
    role.actions.canSpendSol(BigInt(0.11 * LAMPORTS_PER_SOL)),
  ),
);

const roleIdCanSpendSol = swig.roles
  .filter((role) => role.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)))
  .map((role) => role.id);

//
// * find a role by id
//
const maybeDappRole = swig.findRoleById(roleIdCanSpendSol[1]);
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

console.log(
  'balance before first transfer:',
  svm.getBalance(swigWalletAddress),
);

//
// * spend max sol permitted
//
let transfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports: 0.1 * LAMPORTS_PER_SOL,
});

const dappAuthorityRoles = swig.findRolesByEd25519SignerPk(
  dappAuthorityKeypair.publicKey,
);

if (!dappAuthorityRoles.length) throw new Error('Role not found for authority');

const dappAuthorityRole = dappAuthorityRoles[0];

let signTransfer = await getSignInstructions(swig, dappAuthorityRole.id, [
  transfer,
]);

sendSVMTransaction(svm, signTransfer, dappAuthorityKeypair);

console.log('balance after first transfer:', svm.getBalance(swigWalletAddress));

await swig.refetch();

//
// * try spend sol
//
transfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports: 0.05 * LAMPORTS_PER_SOL,
});

signTransfer = await getSignInstructions(swig, dappAuthorityRole.id, [
  transfer,
]);

sendSVMTransaction(svm, signTransfer, dappAuthorityKeypair);

console.log(
  'balance after try second transfer:',
  svm.getBalance(swigWalletAddress),
);
