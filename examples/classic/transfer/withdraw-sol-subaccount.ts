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
  getSwigWalletAddress,
  getWithdrawFromSubAccountCheckedInstructions,
  getWithdrawFromSubAccountInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
} from '@swig-wallet/classic';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import { SolPublicKey, type SwigFetchFn } from '@swig-wallet/lib';
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
    console.log('tx:', tx.logs());
  }
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
    fetchSwigAccount(
      svm,
      new PublicKey(new SolPublicKey(swigAccountAddress).toBytes()),
    );
  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
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

const swigAccountAddress = findSwigPda(id);

console.log('swig address:', swigAccountAddress.toBase58());

const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
});
sendSVMTransaction(svm, [createSwigIx], rootAuthority);

const swig = fetchSwig(svm, swigAccountAddress);

// Get the Swig wallet address
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

let rootRole = swig.roles[0];

const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set().subAccount().get(),
);
sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

await swig.refetch();

let subAccountAuthRole = swig.roles[1];

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

svm.airdrop(subAccountAddress, BigInt(2 * LAMPORTS_PER_SOL));

const initialBalance = svm.getBalance(subAccountAddress)!;
console.log('initial sub-account balance:', initialBalance);

// basic withdrawal using getWithdrawFromSubAccountInstructions
try {
  const basicWithdrawIx = await getWithdrawFromSubAccountInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: BigInt(0.1 * LAMPORTS_PER_SOL),
    },
  );
  sendSVMTransaction(svm, basicWithdrawIx, subAccountAuthority);

  const balanceAfterBasic = svm.getBalance(subAccountAddress)!;
  console.log('balance after basic withdrawal:', balanceAfterBasic);
} catch (error) {
  console.log('basic withdrawal failed:', error);
}

// safe withdrawal with validation using checked function
const currentBalance = svm.getBalance(subAccountAddress)!;
const withdrawAmount = BigInt(0.5 * LAMPORTS_PER_SOL);

try {
  console.log('Using Classic SDK checked withdrawal with validation');

  const safeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: withdrawAmount,
      currentBalance: currentBalance,
      allowBelowRentExempt: false, // Default deny behavior
    },
  );
  sendSVMTransaction(svm, safeWithdrawIx, subAccountAuthority);
} catch (error) {
  console.log(
    'Withdrawal blocked by safety validation:',
    error instanceof Error ? error.message : String(error),
  );
}

const balanceAfterSafe = svm.getBalance(subAccountAddress)!;
console.log('balance after safe withdrawal:', balanceAfterSafe);

// withdrawal that would drop below rent-exempt (with explicit override)
console.log('Attempting risky withdrawal that drops below rent exempt...');
const largeWithdrawAmount = balanceAfterSafe - BigInt(0.001 * LAMPORTS_PER_SOL); // This should leave ~0.001 SOL, below rent-exempt

try {
  // First trying without override (should fail) using Classic SDK
  console.log('This should not happen - withdrawal should be blocked');
} catch (error) {
  console.log(
    'Withdrawal correctly blocked:',
    error instanceof Error ? error.message : String(error),
  );
}

try {
  // Trying with explicit override using Classic SDK
  console.log('Trying risky withdrawal with explicit override...');

  const largeWithdrawIx = await getWithdrawFromSubAccountCheckedInstructions(
    swig,
    subAccountAuthRole.id,
    {
      amount: largeWithdrawAmount,
      currentBalance: balanceAfterSafe,
      allowBelowRentExempt: true, // Explicitly allow risky withdrawal
    },
  );

  console.log('Risky withdrawal allowed with explicit override');
  sendSVMTransaction(svm, largeWithdrawIx, subAccountAuthority);
} catch (error) {
  console.log(
    'Large withdrawal failed:',
    error instanceof Error ? error.message : String(error),
  );
}

const finalBalance = svm.getBalance(subAccountAddress)!;
console.log('final balance after allowed withdrawal:', finalBalance);
console.log('final balance is below rent-exempt:', finalBalance < 1224960n);
