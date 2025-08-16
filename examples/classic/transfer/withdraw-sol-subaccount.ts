import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  findSwigSubAccountPda,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getWithdrawFromSubAccountInstructions,
  getSwigCodec,
  Swig,
  SWIG_PROGRAM_ADDRESS,
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
  return getSwigCodec().decode(swigAccount.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = fetchSwigAccount(svm, swigAddress);

  const swigFetchFn: SwigFetchFn = async (swigAddress) =>
    fetchSwigAccount(svm, new PublicKey((swigAddress as any).toBase58()));

  return new Swig(swigAddress, swigAccount, swigFetchFn);
}

console.log('starting...');

//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

// root authority
const rootAuthority = Keypair.generate();
svm.airdrop(rootAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

// sub account authority
const subAccountAuthority = Keypair.generate();
svm.airdrop(subAccountAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

const id = Uint8Array.from(Array(32).fill(2));

const swigAddress = findSwigPda(id);

console.log('swig address:', swigAddress.toBase58());

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
});
sendSVMTransaction(svm, [createSwigIx], rootAuthority);

const swig = fetchSwig(svm, swigAddress);

let rootRole = swig.roles[0];

// add a sub account authority
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set().subAccount().get(),
);
sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

await swig.refetch();

let subAccountAuthRole = swig.roles[1];

// create sub account
const createSubAccountIx = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
);
sendSVMTransaction(svm, createSubAccountIx, subAccountAuthority);

await swig.refetch();

rootRole = swig.roles[0];
subAccountAuthRole = swig.roles[1];

const subAccountAddress = findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);

// fund the sub-account
svm.airdrop(subAccountAddress, BigInt(2 * LAMPORTS_PER_SOL));

const initialBalance = svm.getBalance(subAccountAddress)!;
console.log('initial sub-account balance:', initialBalance);

// safe withdrawal
const safeWithdrawIx = await getWithdrawFromSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  {
    amount: BigInt(0.5 * LAMPORTS_PER_SOL),
    currentBalance: initialBalance,
    allowBelowRentExempt: false,
  }
);
sendSVMTransaction(svm, safeWithdrawIx, subAccountAuthority);

const balanceAfterSafe = svm.getBalance(subAccountAddress)!;
console.log('balance after safe withdrawal:', balanceAfterSafe);

// withdrawal that would drop below rent-exempt
const largeWithdrawIx = await getWithdrawFromSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  {
    amount: BigInt(1.5 * LAMPORTS_PER_SOL),
    currentBalance: balanceAfterSafe,
    allowBelowRentExempt: true,
  }
);
sendSVMTransaction(svm, largeWithdrawIx, subAccountAuthority);

const finalBalance = svm.getBalance(subAccountAddress)!;
console.log('final balance after allowed withdrawal:', finalBalance);
console.log('final balance is below rent-exempt:', finalBalance < 1224960n);
