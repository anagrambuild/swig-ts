import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import {
  AccountRole,
  generateKeyPairSigner,
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import {
  Actions,
  batchSignTransactions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  type SwigFetchFn,
} from '@swig-wallet/kit';
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

  const swigFetchFn: SwigFetchFn = async (swigAccountAddress) => {
    // swigAccountAddress can be Address (string) or PublicKey
    const address =
      typeof swigAccountAddress === 'string'
        ? new PublicKey(swigAccountAddress)
        : swigAccountAddress;
    const account = svm.getAccount(address);
    if (!account) throw new Error('swig account not found');
    return getSwigCodec().decode(account.data);
  };

  return new Swig(swigAccountAddress.toBase58() as Address, swigAccount, swigFetchFn);
}

function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: bigint;
}): IInstruction {
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
  };
}

// Convert Kit signed transaction to web3.js Transaction for LiteSVM
function convertKitTransactionToWeb3(
  kitSignedTransaction: Awaited<
    ReturnType<typeof import('@solana/kit').signTransactionMessageWithSigners>
  >,
): Transaction {
  // Get serialized bytes from Kit transaction
  let serialized: Uint8Array;
  if (
    'serialize' in kitSignedTransaction &&
    typeof kitSignedTransaction.serialize === 'function'
  ) {
    serialized = kitSignedTransaction.serialize();
  } else if ('serializedBytes' in kitSignedTransaction) {
    serialized = kitSignedTransaction.serializedBytes as Uint8Array;
  } else {
    throw new Error('Unable to serialize Kit transaction');
  }

  // Deserialize into web3.js Transaction
  return Transaction.from(serialized);
}

console.log('starting batch signing example (Kit)...');

//
// Start program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();

svm.addProgram(new PublicKey(SWIG_PROGRAM_ADDRESS), swigProgram);

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
const swigAccountAddress = await findSwigPda(id);
const swigAccountPublicKey = new PublicKey(swigAccountAddress);

console.log('swig account address:', swigAccountAddress);

//
// Create swig instruction
//
const rootActions = Actions.set().all().get();

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo: createEd25519AuthorityInfo(
    userRootKeypair.publicKey.toBase58() as Address,
  ),
  id,
  payer: userRootKeypair.publicKey.toBase58() as Address,
  actions: rootActions,
});

// Convert Kit instruction to web3.js for LiteSVM
const createTx = new Transaction();
createTx.add({
  programId: new PublicKey(createSwigInstruction.programAddress),
  keys: createSwigInstruction.accounts.map((acc) => ({
    pubkey: new PublicKey(acc.address),
    isSigner: acc.role === AccountRole.WRITABLE_SIGNER || acc.role === AccountRole.READONLY_SIGNER,
    isWritable: acc.role === AccountRole.WRITABLE_SIGNER || acc.role === AccountRole.WRITABLE,
  })),
  data: Buffer.from(createSwigInstruction.data),
});
createTx.feePayer = userRootKeypair.publicKey;
createTx.recentBlockhash = svm.latestBlockhash();
createTx.sign(userRootKeypair);
sendSVMTransaction(svm, createTx);

//
// Fetch swig
//
const swig = fetchSwig(svm, swigAccountPublicKey);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress);

//
// Find role by ed25519 signer
//
const rootRoles = swig.findRolesByEd25519SignerPk(
  userRootKeypair.publicKey.toBase58() as Address,
);

if (!rootRoles.length) throw new Error('Role not found for authority');

const rootRole = rootRoles[0];

//
// Add dapp authority
//
const dappActions = Actions.set().all().get();

const addAuthorityIx = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(
    dappAuthorityKeypair.publicKey.toBase58() as Address,
  ),
  dappActions,
  { payer: userRootKeypair.publicKey.toBase58() as Address },
);

// Convert Kit instructions to web3.js for LiteSVM
const addAuthTx = new Transaction();
for (const ix of addAuthorityIx) {
  addAuthTx.add({
    programId: new PublicKey(ix.programAddress),
    keys: ix.accounts.map((acc) => ({
      pubkey: new PublicKey(acc.address),
      isSigner: acc.role === AccountRole.WRITABLE_SIGNER || acc.role === AccountRole.READONLY_SIGNER,
      isWritable: acc.role === AccountRole.WRITABLE_SIGNER || acc.role === AccountRole.WRITABLE,
    })),
    data: Buffer.from(ix.data),
  });
}
addAuthTx.feePayer = userRootKeypair.publicKey;
addAuthTx.recentBlockhash = svm.latestBlockhash();
addAuthTx.sign(userRootKeypair);
sendSVMTransaction(svm, addAuthTx);

await swig.refetch();

const dappRoles = swig.findRolesByEd25519SignerPk(
  dappAuthorityKeypair.publicKey.toBase58() as Address,
);

if (!dappRoles.length) throw new Error('Role not found for dapp authority');

const dappRole = dappRoles[0];

// Airdrop to swig wallet
svm.airdrop(new PublicKey(swigWalletAddress), BigInt(2 * LAMPORTS_PER_SOL));

await swig.refetch();

console.log(
  'balance before batch transfers:',
  svm.getBalance(new PublicKey(swigWalletAddress)),
);

//
// Create multiple transfer instructions for batch signing
//
const transferAmount = 0.1 * LAMPORTS_PER_SOL;
const transfers: IInstruction[] = [];

// Create 3 transfer instructions
for (let i = 0; i < 3; i++) {
  transfers.push(
    getSolTransferInstruction({
      fromAddress: swigWalletAddress as Address,
      toAddress: dappTreasury.toBase58() as Address,
      lamports: BigInt(transferAmount),
    }),
  );
}

const latestBlockhash = svm.latestBlockhash();
//
// Batch sign transactions - Full signing (Swig + all signers)
// Note: Kit's signTransactionMessageWithSigners requires all signatures,
// so partial signing is not demonstrated here. See classic example for partial signing.
//
console.log('\n=== Batch Signing: Full Sign (Swig + all signers) ===');

// Create a KeyPairSigner from web3.js Keypair
// We need to extract the secretKey and use it to sign
const dappAuthoritySigner: KeyPairSigner = {
  address: dappAuthorityKeypair.publicKey.toBase58() as Address,
  signMessage: async (message: Uint8Array) => {
    // Use nacl to sign the message with the keypair's secretKey
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nacl = require('tweetnacl');
    const signature = nacl.sign.detached(message, dappAuthorityKeypair.secretKey);
    return new Uint8Array(signature);
  },
};

const freshBlockhash = svm.latestBlockhash();
const freshBlockhashObj: Readonly<{
  blockhash: Blockhash;
  lastValidBlockHeight: bigint;
}> = {
  blockhash: freshBlockhash as Blockhash,
  lastValidBlockHeight: BigInt(0),
};

const fullSigned = await batchSignTransactions(
  {
    swig,
    roleId: dappRole.id,
    transactions: transfers.map((transfer) => ({
      innerInstructions: [transfer],
      feePayer: dappAuthoritySigner,
      recentBlockhash: freshBlockhashObj, // Fresh blockhash
      signers: [dappAuthoritySigner],
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

// Convert Kit transactions to web3.js and send
for (const signed of fullSigned) {
  const web3Tx = convertKitTransactionToWeb3(signed.transaction);
  sendSVMTransaction(svm, web3Tx);
}

// Expire blockhash after sending transactions
svm.expireBlockhash();

console.log(
  'balance after batch full transfers:',
  svm.getBalance(new PublicKey(swigWalletAddress)),
);

//
// Example: Send transactions to third-party service (simulated)
//
console.log('\n=== Sending to Third-Party Service ===');

const thirdPartyBlockhash = svm.latestBlockhash();
const thirdPartyBlockhashObj: Readonly<{
  blockhash: Blockhash;
  lastValidBlockHeight: bigint;
}> = {
  blockhash: thirdPartyBlockhash as Blockhash,
  lastValidBlockHeight: BigInt(0),
};

const thirdPartySigned = await batchSignTransactions(
  {
    swig,
    roleId: dappRole.id,
    transactions: [
      {
        innerInstructions: [
          getSolTransferInstruction({
            fromAddress: swigWalletAddress as Address,
            toAddress: dappTreasury.toBase58() as Address,
            lamports: BigInt(transferAmount),
          }),
        ],
        feePayer: dappAuthoritySigner,
        recentBlockhash: thirdPartyBlockhashObj,
        signers: [dappAuthoritySigner],
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

