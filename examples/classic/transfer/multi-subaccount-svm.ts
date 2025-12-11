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
  findSwigSubAccountPda,
  findSwigSubAccountPdaWithIndex,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
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
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { readFileSync } from 'node:fs';

//
// Helpers
//
function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
) {
  svm.expireBlockhash();

  const tx = new Transaction();
  tx.instructions = instructions;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);

  const res = svm.sendTransaction(tx);

  if (res instanceof FailedTransactionMetadata) {
    console.log('❌ tx logs:', res.meta().logs());
    throw new Error('Transaction failed');
  }
  return res;
}

function fetchSwigAccount(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): SwigAccount {
  const swigAccount = svm.getAccount(swigAccountAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return getSwigCodec().decode(Uint8Array.from(swigAccount.data));
}

function fetchSwig(svm: LiteSVM, swigAccountAddress: PublicKey): Swig {
  const account = fetchSwigAccount(svm, swigAccountAddress);
  const swigFetchFn: SwigFetchFn = async (addr) =>
    fetchSwigAccount(svm, toPublicKey(addr));
  return new Swig(swigAccountAddress, account, swigFetchFn);
}

//
// Main
//
console.log('🚀 Starting multiple subaccounts test...\n');
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const rootAuthority = Keypair.generate();
svm.airdrop(rootAuthority.publicKey, BigInt(LAMPORTS_PER_SOL * 10));
console.log('👤 Root authority:', rootAuthority.publicKey.toBase58());

const subAccountAuthority = Keypair.generate();
svm.airdrop(subAccountAuthority.publicKey, BigInt(LAMPORTS_PER_SOL * 10));
console.log(
  '👤 SubAccount authority:',
  subAccountAuthority.publicKey.toBase58(),
);

const id = Uint8Array.from(Array(32).fill(3));
const swigAccountAddress = findSwigPda(id);
console.log('🏦 Swig account:', swigAccountAddress.toBase58());

// Create Swig with All permissions for root
const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
});
sendSVMTransaction(svm, [createSwigIx], rootAuthority);

const swig = fetchSwig(svm, swigAccountAddress);
console.log('✅ Swig created (version:', swig.accountVersion(), ')\n');

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('💰 Swig wallet:', swigWalletAddress.toBase58());

const rootRole = swig.roles[0];
console.log('🎭 Root role ID:', rootRole.id);

// Add subaccount authority role with multiple subaccount actions (index 0, 1, 2)
console.log('\n📝 Adding subaccount authority role with 3 subaccount slots...');
const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.publicKey),
  Actions.set()
    .subAccount(0) // Allow index 0
    .subAccount(1) // Allow index 1
    .subAccount(2) // Allow index 2
    .manageAuthority()
    .get(),
);
sendSVMTransaction(svm, addAuthorityIx, rootAuthority);

await swig.refetch();
const subAccountAuthRole = swig.roles[1];
console.log('✅ SubAccount auth role ID:', subAccountAuthRole.id);

// ==========================================
// Test 1: Create subaccount with index 0 (legacy/default)
// ==========================================
console.log('\n🧪 TEST 1: Creating subaccount with index 0 (default)...');
const createSubAccount0Ix = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  { subAccountIndex: 0 }, // Explicitly use index 0
);
sendSVMTransaction(svm, createSubAccount0Ix, subAccountAuthority);

await swig.refetch();

// Derive using both methods - they should match for index 0
const subAccount0AddressLegacy = findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);
const subAccount0AddressNew = findSwigSubAccountPdaWithIndex(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
  0,
);

console.log(
  '📍 SubAccount 0 (legacy PDA):',
  subAccount0AddressLegacy.toBase58(),
);
console.log('📍 SubAccount 0 (new PDA):', subAccount0AddressNew.toBase58());

// Verify they match
if (subAccount0AddressLegacy.toBase58() !== subAccount0AddressNew.toBase58()) {
  throw new Error(
    '❌ Index 0 PDA derivation mismatch! Legacy and new methods should match.',
  );
}
console.log('✅ Index 0 backwards compatibility verified!');

// Fund and test subaccount 0
svm.airdrop(subAccount0AddressLegacy, BigInt(LAMPORTS_PER_SOL * 2));
console.log(
  '💰 SubAccount 0 balance:',
  svm.getBalance(subAccount0AddressLegacy),
);

const recipient0 = Keypair.generate().publicKey;
console.log('👤 Recipient 0:', recipient0.toBase58());
const transfer0 = SystemProgram.transfer({
  fromPubkey: subAccount0AddressLegacy,
  toPubkey: recipient0,
  lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
});

const signIx0 = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer0],
  true,
);
sendSVMTransaction(svm, signIx0, subAccountAuthority);

console.log(
  '💸 SubAccount 0 new balance:',
  svm.getBalance(subAccount0AddressLegacy),
);
console.log('💰 Recipient 0 balance:', svm.getBalance(recipient0));
console.log('✅ SubAccount 0 transfer successful!\n');

// ==========================================
// Test 2: Create subaccount with index 1
// ==========================================
console.log('🧪 TEST 2: Creating subaccount with index 1...');
const createSubAccount1Ix = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  { subAccountIndex: 1 },
);
sendSVMTransaction(svm, createSubAccount1Ix, subAccountAuthority);

await swig.refetch();

const subAccount1Address = findSwigSubAccountPdaWithIndex(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
  1,
);
console.log('📍 SubAccount 1 address:', subAccount1Address.toBase58());

// Verify it's different from index 0
if (subAccount1Address.toBase58() === subAccount0AddressLegacy.toBase58()) {
  throw new Error(
    '❌ SubAccount 1 should have different address than index 0!',
  );
}
console.log('✅ SubAccount 1 has unique address');

// Fund and test subaccount 1
svm.airdrop(subAccount1Address, BigInt(LAMPORTS_PER_SOL * 2));
console.log('💰 SubAccount 1 balance:', svm.getBalance(subAccount1Address));

const recipient1 = Keypair.generate().publicKey;
console.log('👤 Recipient 1:', recipient1.toBase58());
const transfer1 = SystemProgram.transfer({
  fromPubkey: subAccount1Address,
  toPubkey: recipient1,
  lamports: Math.floor(0.15 * LAMPORTS_PER_SOL),
});

const signIx1 = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer1],
  true,
  { subAccountIndex: 1 }, // Use subaccount at index 1
);
sendSVMTransaction(svm, signIx1, subAccountAuthority);

console.log('💸 SubAccount 1 new balance:', svm.getBalance(subAccount1Address));
console.log('💰 Recipient 1 balance:', svm.getBalance(recipient1));
console.log('✅ SubAccount 1 transfer successful!\n');

// ==========================================
// Test 3: Create subaccount with index 2
// ==========================================
console.log('🧪 TEST 3: Creating subaccount with index 2...');
const createSubAccount2Ix = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  { subAccountIndex: 2 },
);
sendSVMTransaction(svm, createSubAccount2Ix, subAccountAuthority);

await swig.refetch();

const subAccount2Address = findSwigSubAccountPdaWithIndex(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
  2,
);
console.log('📍 SubAccount 2 address:', subAccount2Address.toBase58());

// Verify it's different from both previous subaccounts
if (
  subAccount2Address.toBase58() === subAccount0AddressLegacy.toBase58() ||
  subAccount2Address.toBase58() === subAccount1Address.toBase58()
) {
  throw new Error('❌ SubAccount 2 should have unique address!');
}
console.log('✅ SubAccount 2 has unique address');

// Fund and test subaccount 2
svm.airdrop(subAccount2Address, BigInt(LAMPORTS_PER_SOL * 2));
console.log('💰 SubAccount 2 balance:', svm.getBalance(subAccount2Address));

const recipient2 = Keypair.generate().publicKey;
console.log('👤 Recipient 2:', recipient2.toBase58());
const transfer2 = SystemProgram.transfer({
  fromPubkey: subAccount2Address,
  toPubkey: recipient2,
  lamports: Math.floor(0.2 * LAMPORTS_PER_SOL),
});

const signIx2 = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer2],
  true,
  { subAccountIndex: 2 }, // Use subaccount at index 2
);
sendSVMTransaction(svm, signIx2, subAccountAuthority);

console.log('💸 SubAccount 2 new balance:', svm.getBalance(subAccount2Address));
console.log('💰 Recipient 2 balance:', svm.getBalance(recipient2));
console.log('✅ SubAccount 2 transfer successful!\n');

// ==========================================
// Final Summary
// ==========================================
console.log('📊 FINAL SUMMARY:');
console.log('================');
console.log(`SubAccount 0 (index 0): ${subAccount0AddressLegacy.toBase58()}`);
console.log(`  Balance: ${svm.getBalance(subAccount0AddressLegacy)}`);
console.log(`  Recipient balance: ${svm.getBalance(recipient0)}`);
console.log('');
console.log(`SubAccount 1 (index 1): ${subAccount1Address.toBase58()}`);
console.log(`  Balance: ${svm.getBalance(subAccount1Address)}`);
console.log(`  Recipient balance: ${svm.getBalance(recipient1)}`);
console.log('');
console.log(`SubAccount 2 (index 2): ${subAccount2Address.toBase58()}`);
console.log(`  Balance: ${svm.getBalance(subAccount2Address)}`);
console.log(`  Recipient balance: ${svm.getBalance(recipient2)}`);
console.log('');
console.log('✅ ALL TESTS PASSED! Multiple subaccounts working correctly! 🎉');
