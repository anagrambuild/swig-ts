import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import {
  AccountRole,
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  findSwigSubAccountPda,
  findSwigSubAccountPdaWithIndex,
  getAddAuthorityInstructions,
  getCreateSubAccountInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
} from '@swig-wallet/kit';

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

const LAMPORTS_PER_SOL = 1_000_000_000n;

// ---------- helpers ----------
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: Rpc<SolanaRpcApi>,
  to: Address,
  amount: bigint,
) {
  const sig = await rpc.requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1000);
}

function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: bigint;
}) {
  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      { address: args.fromAddress, role: AccountRole.WRITABLE_SIGNER },
      { address: args.toAddress, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({
        amount: args.lamports,
      }),
    ),
  } satisfies IInstruction;
}

function getTransactionMessage<Inst extends IInstruction[]>(
  instructions: Inst,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  feePayer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );
}

async function sendTransaction<T extends IInstruction[]>(
  connection: {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  },
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = getTransactionMessage(
    instructions,
    latestBlockhash,
    payer,
    signers,
  );
  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection)(signed, {
    commitment: 'confirmed',
  });

  return getSignatureFromTransaction(signed).toString();
}

// ---------- main ----------
console.log('🚀 Starting multiple subaccounts test (Kit)...\n');

const connection = {
  rpc: createSolanaRpc('http://localhost:8899'),
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
};

// Root authority
const rootAuthority = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  rootAuthority.address,
  10n * LAMPORTS_PER_SOL,
);
console.log('👤 Root authority:', rootAuthority.address);

// Sub-account authority manager
const subAccountAuthority = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  subAccountAuthority.address,
  10n * LAMPORTS_PER_SOL,
);
console.log('👤 SubAccount authority:', subAccountAuthority.address);

const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('🏦 Swig address:', swigAccountAddress);

// Create SWIG (root has all actions)
const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthority.address,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.address),
  id,
});
await sendTransaction(connection, [createSwigIx], rootAuthority);

const swig = await fetchSwig(connection.rpc, swigAccountAddress);
console.log('✅ Swig created (version: v2)\n');

// Resolve root role by signer
const rootRole = swig.findRolesByEd25519SignerPk(rootAuthority.address)[0];
if (!rootRole) throw new Error('Root role not found');
console.log('🎭 Root role ID:', rootRole.id);

// Add an authority that can manage sub-accounts with multiple subaccount slots (index 0, 1, 2)
console.log('\n📝 Adding subaccount authority role with 3 subaccount slots...');
const addAuthorityIxs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(subAccountAuthority.address),
  Actions.set()
    .subAccount(0) // Allow index 0
    .subAccount(1) // Allow index 1
    .subAccount(2) // Allow index 2
    .manageAuthority()
    .get(),
  { payer: rootAuthority.address },
);
await sendTransaction(connection, addAuthorityIxs, rootAuthority);

// Refetch to see the new role
await swig.refetch();

let subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0];
if (!subAccountAuthRole)
  throw new Error('Sub-account authority role not found');
console.log('✅ SubAccount auth role ID:', subAccountAuthRole.id);

// ==========================================
// Test 1: Create subaccount with index 0 (legacy/default)
// ==========================================
console.log('\n🧪 TEST 1: Creating subaccount with index 0 (default)...');
const createSubAccount0Ix = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  {
    payer: subAccountAuthority.address,
    subAccountIndex: 0, // Explicitly use index 0
  },
);
await sendTransaction(connection, createSubAccount0Ix, subAccountAuthority);

await swig.refetch();
subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0]!;

// Derive using both methods - they should match for index 0
const subAccount0AddressLegacy = await findSwigSubAccountPda(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
);
const subAccount0AddressNew = await findSwigSubAccountPdaWithIndex(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
  0,
);

console.log('📍 SubAccount 0 (legacy PDA):', subAccount0AddressLegacy);
console.log('📍 SubAccount 0 (new PDA):', subAccount0AddressNew);

// Verify they match
if (subAccount0AddressLegacy !== subAccount0AddressNew) {
  throw new Error(
    '❌ Index 0 PDA derivation mismatch! Legacy and new methods should match.',
  );
}
console.log('✅ Index 0 backwards compatibility verified!');

// Fund sub-account
await confirmAirdrop(
  connection.rpc,
  subAccount0AddressLegacy,
  2n * LAMPORTS_PER_SOL,
);

const subBalance0 = (
  await connection.rpc.getBalance(subAccount0AddressLegacy).send()
).value;
console.log('💰 SubAccount 0 balance:', subBalance0.toString());

// Prepare a transfer from the sub-account
const recipient0 = (await generateKeyPairSigner()).address;
console.log('👤 Recipient 0:', recipient0);
const transfer0 = getSolTransferInstruction({
  lamports: LAMPORTS_PER_SOL / 10n, // 0.1 SOL
  toAddress: recipient0,
  fromAddress: subAccount0AddressLegacy,
});

// Fresh finalized slot
const signSlot0 = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

// Sign (from sub-account) and send
const signIx0 = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer0],
  true,
  { payer: subAccountAuthority.address, currentSlot: signSlot0 },
);

await sendTransaction(connection, signIx0, subAccountAuthority);

const newSubBalance0 = (
  await connection.rpc.getBalance(subAccount0AddressLegacy).send()
).value;
console.log('💸 SubAccount 0 new balance:', newSubBalance0.toString());

const recipientBalance0 = (await connection.rpc.getBalance(recipient0).send())
  .value;
console.log('💰 Recipient 0 balance:', recipientBalance0.toString());
console.log('✅ SubAccount 0 transfer successful!\n');

// ==========================================
// Test 2: Create subaccount with index 1
// ==========================================
console.log('🧪 TEST 2: Creating subaccount with index 1...');
const createSubAccount1Ix = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  {
    payer: subAccountAuthority.address,
    subAccountIndex: 1,
  },
);
await sendTransaction(connection, createSubAccount1Ix, subAccountAuthority);

await swig.refetch();
subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0]!;

const subAccount1Address = await findSwigSubAccountPdaWithIndex(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
  1,
);
console.log('📍 SubAccount 1 address:', subAccount1Address);

// Verify it's different from index 0
if (subAccount1Address === subAccount0AddressLegacy) {
  throw new Error(
    '❌ SubAccount 1 should have different address than index 0!',
  );
}
console.log('✅ SubAccount 1 has unique address');

// Fund sub-account
await confirmAirdrop(connection.rpc, subAccount1Address, 2n * LAMPORTS_PER_SOL);

const subBalance1 = (await connection.rpc.getBalance(subAccount1Address).send())
  .value;
console.log('💰 SubAccount 1 balance:', subBalance1.toString());

// Prepare a transfer from the sub-account
const recipient1 = (await generateKeyPairSigner()).address;
console.log('👤 Recipient 1:', recipient1);
const transfer1 = getSolTransferInstruction({
  lamports: (LAMPORTS_PER_SOL * 15n) / 100n, // 0.15 SOL
  toAddress: recipient1,
  fromAddress: subAccount1Address,
});

const signSlot1 = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const signIx1 = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer1],
  true,
  {
    payer: subAccountAuthority.address,
    currentSlot: signSlot1,
    subAccountIndex: 1,
  },
);

await sendTransaction(connection, signIx1, subAccountAuthority);

const newSubBalance1 = (
  await connection.rpc.getBalance(subAccount1Address).send()
).value;
console.log('💸 SubAccount 1 new balance:', newSubBalance1.toString());

const recipientBalance1 = (await connection.rpc.getBalance(recipient1).send())
  .value;
console.log('💰 Recipient 1 balance:', recipientBalance1.toString());
console.log('✅ SubAccount 1 transfer successful!\n');

// ==========================================
// Test 3: Create subaccount with index 2
// ==========================================
console.log('🧪 TEST 3: Creating subaccount with index 2...');
const createSubAccount2Ix = await getCreateSubAccountInstructions(
  swig,
  subAccountAuthRole.id,
  {
    payer: subAccountAuthority.address,
    subAccountIndex: 2,
  },
);
await sendTransaction(connection, createSubAccount2Ix, subAccountAuthority);

await swig.refetch();
subAccountAuthRole = swig.findRolesByEd25519SignerPk(
  subAccountAuthority.address,
)[0]!;

const subAccount2Address = await findSwigSubAccountPdaWithIndex(
  subAccountAuthRole.swigId,
  subAccountAuthRole.id,
  2,
);
console.log('📍 SubAccount 2 address:', subAccount2Address);

// Verify it's different from both previous subaccounts
if (
  subAccount2Address === subAccount0AddressLegacy ||
  subAccount2Address === subAccount1Address
) {
  throw new Error('❌ SubAccount 2 should have unique address!');
}
console.log('✅ SubAccount 2 has unique address');

// Fund sub-account
await confirmAirdrop(connection.rpc, subAccount2Address, 2n * LAMPORTS_PER_SOL);

const subBalance2 = (await connection.rpc.getBalance(subAccount2Address).send())
  .value;
console.log('💰 SubAccount 2 balance:', subBalance2.toString());

// Prepare a transfer from the sub-account
const recipient2 = (await generateKeyPairSigner()).address;
console.log('👤 Recipient 2:', recipient2);
const transfer2 = getSolTransferInstruction({
  lamports: LAMPORTS_PER_SOL / 5n, // 0.2 SOL
  toAddress: recipient2,
  fromAddress: subAccount2Address,
});

const signSlot2 = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const signIx2 = await getSignInstructions(
  swig,
  subAccountAuthRole.id,
  [transfer2],
  true,
  {
    payer: subAccountAuthority.address,
    currentSlot: signSlot2,
    subAccountIndex: 2,
  },
);

await sendTransaction(connection, signIx2, subAccountAuthority);

const newSubBalance2 = (
  await connection.rpc.getBalance(subAccount2Address).send()
).value;
console.log('💸 SubAccount 2 new balance:', newSubBalance2.toString());

const recipientBalance2 = (await connection.rpc.getBalance(recipient2).send())
  .value;
console.log('💰 Recipient 2 balance:', recipientBalance2.toString());
console.log('✅ SubAccount 2 transfer successful!\n');

// ==========================================
// Final Summary
// ==========================================
console.log('📊 FINAL SUMMARY:');
console.log('================');
console.log(`SubAccount 0 (index 0): ${subAccount0AddressLegacy}`);
console.log(`  Balance: ${newSubBalance0.toString()}`);
console.log(`  Recipient balance: ${recipientBalance0.toString()}`);
console.log('');
console.log(`SubAccount 1 (index 1): ${subAccount1Address}`);
console.log(`  Balance: ${newSubBalance1.toString()}`);
console.log(`  Recipient balance: ${recipientBalance1.toString()}`);
console.log('');
console.log(`SubAccount 2 (index 2): ${subAccount2Address}`);
console.log(`  Balance: ${newSubBalance2.toString()}`);
console.log(`  Recipient balance: ${recipientBalance2.toString()}`);
console.log('');
console.log('✅ ALL TESTS PASSED! Multiple subaccounts working correctly! 🎉');
