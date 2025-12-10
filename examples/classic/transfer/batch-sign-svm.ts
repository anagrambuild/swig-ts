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
  batchSignTransactions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
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
  transaction: Transaction,
): TransactionMetadata | FailedTransactionMetadata {
  const tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx failed:', tx.meta().logs());
  } else {
    console.log('tx success');
  }
  return tx;
}

function fetchSwigAccount(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): SwigAccount {
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
    fetchSwigAccount(svm, toPublicKey(swigAccountAddress));

  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
}

console.log('starting batch signing example...');

//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

// user root
const userRootKeypair = Keypair.generate();
svm.airdrop(userRootKeypair.publicKey, BigInt(5 * LAMPORTS_PER_SOL));

// dapp authority
const dappAuthorityKeypair = Keypair.generate();
svm.airdrop(dappAuthorityKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

const dappTreasury = Keypair.generate().publicKey;

const id = Uint8Array.from(Array(32).fill(2));

//
// Find a swig pda by id
//
const swigAccountAddress = findSwigPda(id);

console.log('swig account address:', swigAccountAddress.toBase58());

//
// Create swig instruction
//
const rootActions = Actions.set().all().get();

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createEd25519AuthorityInfo(userRootKeypair.publicKey),
  id,
  payer: userRootKeypair.publicKey,
  actions: rootActions,
});

const createTx = new Transaction();
createTx.add(createSwigInstruction);
createTx.feePayer = userRootKeypair.publicKey;
createTx.recentBlockhash = svm.latestBlockhash();
createTx.sign(userRootKeypair);
sendSVMTransaction(svm, createTx);

//
// Fetch swig
//
const swig = fetchSwig(svm, swigAccountAddress);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

//
// Find role by ed25519 signer
//
const rootRoles = swig.findRolesByEd25519SignerPk(userRootKeypair.publicKey);

if (!rootRoles.length) throw new Error('Role not found for authority');

const rootRole = rootRoles[0];

//
// Add dapp authority
//
const dappActions = Actions.set().all().get();

const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(dappAuthorityKeypair.publicKey),
  dappActions,
);

const addAuthTx = new Transaction();
addAuthTx.add(...addAuthorityIx);
addAuthTx.feePayer = userRootKeypair.publicKey;
addAuthTx.recentBlockhash = svm.latestBlockhash();
addAuthTx.sign(userRootKeypair);
sendSVMTransaction(svm, addAuthTx);

await swig.refetch();

const dappRoles = swig.findRolesByEd25519SignerPk(
  dappAuthorityKeypair.publicKey,
);

if (!dappRoles.length) throw new Error('Role not found for dapp authority');

const dappRole = dappRoles[0];

// Airdrop to swig wallet
svm.airdrop(swigWalletAddress, BigInt(2 * LAMPORTS_PER_SOL));

await swig.refetch();

console.log(
  'balance before batch transfers:',
  svm.getBalance(swigWalletAddress),
);

//
// Create multiple transfer instructions for batch signing
//
const transferAmount = 0.1 * LAMPORTS_PER_SOL;
const transfers: TransactionInstruction[] = [];

// Create 3 transfer instructions
for (let i = 0; i < 3; i++) {
  transfers.push(
    SystemProgram.transfer({
      fromPubkey: swigWalletAddress,
      toPubkey: dappTreasury,
      lamports: transferAmount,
    }),
  );
}

const blockhash = svm.latestBlockhash();

//
// Batch sign transactions - Partial signing (Swig only)
//
console.log('\n=== Batch Signing: Partial Sign (Swig only) ===');

const partialSigned = await batchSignTransactions(
  {
    swig,
    roleId: dappRole.id,
    transactions: transfers.map((transfer) => ({
      innerInstructions: [transfer],
      feePayer: dappAuthorityKeypair.publicKey,
      recentBlockhash: blockhash,
      signers: [dappAuthorityKeypair], // Will be used for full signing
    })),
  },
  {
    signMode: 'partial',
    encoding: 'buffer', // Request all encodings
  },
);

console.log(`Signed ${partialSigned.length} transactions`);
console.log('First transaction encoding formats:');
console.log(
  '  Base64:',
  partialSigned[0].encoded.base64.substring(0, 50) + '...',
);
console.log(
  '  Base58:',
  partialSigned[0].encoded.base58.substring(0, 50) + '...',
);
console.log('  Buffer length:', partialSigned[0].encoded.buffer.length);
console.log('  Is fully signed:', partialSigned[0].isFullySigned);

// Send first partially signed transaction (need to add payer signature)
const partialTx = partialSigned[0].transaction;
partialTx.sign(dappAuthorityKeypair); // Add payer signature
sendSVMTransaction(svm, partialTx);

// Expire blockhash after sending transactions
svm.expireBlockhash();

console.log(
  'balance after first partial transfer:',
  svm.getBalance(swigWalletAddress),
);

await swig.refetch();

//
// Batch sign transactions - Full signing (Swig + all signers)
//
console.log('\n=== Batch Signing: Full Sign (Swig + all signers) ===');

const fullSigned = await batchSignTransactions(
  {
    swig,
    roleId: dappRole.id,
    transactions: transfers.slice(1).map((transfer) => ({
      innerInstructions: [transfer],
      feePayer: dappAuthorityKeypair.publicKey,
      recentBlockhash: svm.latestBlockhash(), // Fresh blockhash
      signers: [dappAuthorityKeypair],
    })),
  },
  {
    signMode: 'full',
  },
);

console.log(`Signed ${fullSigned.length} transactions`);
console.log('First transaction encoding formats:');
console.log('  Base64:', fullSigned[0].encoded.base64.substring(0, 50) + '...');
console.log('  Base58:', fullSigned[0].encoded.base58.substring(0, 50) + '...');
console.log('  Buffer length:', fullSigned[0].encoded.buffer.length);
console.log('  Is fully signed:', fullSigned[0].isFullySigned);

// Send fully signed transactions directly
for (const signed of fullSigned) {
  sendSVMTransaction(svm, signed.transaction);
}

console.log(
  'balance after batch full transfers:',
  svm.getBalance(swigWalletAddress),
);

//
// Example: Send transactions to third-party service (simulated)
//
console.log('\n=== Sending to Third-Party Service ===');

const thirdPartySigned = await batchSignTransactions(
  {
    swig,
    roleId: dappRole.id,
    transactions: [
      {
        innerInstructions: [
          SystemProgram.transfer({
            fromPubkey: swigWalletAddress,
            toPubkey: dappTreasury,
            lamports: transferAmount,
          }),
        ],
        feePayer: dappAuthorityKeypair.publicKey,
        recentBlockhash: svm.latestBlockhash(),
        signers: [dappAuthorityKeypair],
      },
    ],
  },
  {
    signMode: 'partial', // Partial for third-party to add their signature
    encoding: 'base64', // Request base64 for API
  },
);

// Simulate sending to third-party service
console.log('Sending transaction to third-party service:');
console.log('  Transaction (base64):', thirdPartySigned[0].encoded.base64);
console.log('  Transaction (base58):', thirdPartySigned[0].encoded.base58);
console.log(
  '  Transaction (buffer length):',
  thirdPartySigned[0].encoded.buffer.length,
);

console.log('\n✅ Batch signing example completed!');
