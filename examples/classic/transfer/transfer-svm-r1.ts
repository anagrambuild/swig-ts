import { p256 } from '@noble/curves/nist';
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
  createSecp256r1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256r1PrivateKey,
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
): TransactionMetadata | FailedTransactionMetadata {
  // ensure fresh blockhash each send
  svm.expireBlockhash();

  const tx = new Transaction();
  tx.instructions = instructions;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);

  const result = svm.sendTransaction(tx);

  if (result instanceof FailedTransactionMetadata) {
    console.error(
      '❌ Transaction failed. Logs:\n',
      result.meta().logs().join('\n'),
    );
  } else {
    console.log('✅ Transaction succeeded');
  }
  return result;
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
    fetchSwigAccount(svm, toPublicKey(swigAccountAddress));

  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
}

console.log('🚀 starting…');

//
// Boot LiteSVM with Swig program
//
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);
console.log('📦 Swig program loaded into LiteSVM');

//
// Authorities
//
const r1 = p256.keygen(); // { secretKey, publicKey }
const rootPayer = Keypair.generate();
const feePayer = Keypair.generate(); // will pay for signed tx
const dappTreasury = Keypair.generate().publicKey;

svm.airdrop(rootPayer.publicKey, BigInt(LAMPORTS_PER_SOL));
svm.airdrop(feePayer.publicKey, BigInt(LAMPORTS_PER_SOL));

//
// Derive Swig PDA and create Swig with secp256r1 root
//
const id = Uint8Array.from(Array(32).fill(0));
const swigAccountAddress = findSwigPda(id);
console.log('📌 Swig PDA:', swigAccountAddress.toBase58());

const rootActions = Actions.set().all().get();
const createIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256r1AuthorityInfo(r1.publicKey),
  id,
  payer: rootPayer.publicKey,
  actions: rootActions,
});

let res = sendSVMTransaction(svm, [createIx], rootPayer);
if (res instanceof FailedTransactionMetadata) {
  throw new Error('Failed to create Swig');
}

//
// Fetch Swig and locate the root role (secp256r1)
//
let swig = fetchSwig(svm, swigAccountAddress);

const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress.toBase58());

// If your SDK exposes a dedicated finder like
// swig.findRolesBySecp256r1SignerPk(r1.publicKey), prefer that.
// Otherwise, use the generic authority-signer finder with the compressed pubkey:
const r1CompressedPub = p256.getPublicKey(r1.secretKey, true);
const r1Roles = swig.findRolesByAuthoritySigner(r1CompressedPub);
if (!r1Roles.length)
  throw new Error('Root role not found for secp256r1 authority');
const rootRole = r1Roles[0];
console.log('🔑 Root role id:', rootRole.id.toString());

//
// Prepare signingFn for secp256r1
//
const signingFn = getSigningFnForSecp256r1PrivateKey(r1.secretKey);

//
// Fund the Swig PDA and refetch
//
svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));
swig = fetchSwig(svm, swigAccountAddress);
await swig.refetch();

const balanceBefore = svm.getBalance(swigWalletAddress);
console.log(
  '💰 Balance before transfer:',
  balanceBefore !== null ? balanceBefore.toString() : 'Account not found',
);

//
// Transfer 0.1 SOL from Swig to dappTreasury using the r1 root role
//
const lamports = BigInt(0.1 * LAMPORTS_PER_SOL);

const transferIx = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: dappTreasury,
  lamports, // BigInt acceptable in LiteSVM path
});

const signIxs = await getSignInstructions(
  swig,
  rootRole.id,
  [transferIx],
  false, // do not merge with previous
  {
    payer: feePayer.publicKey,
    signingFn,
    currentSlot: svm.getClock().slot,
  },
);

res = sendSVMTransaction(svm, signIxs, feePayer);
if (res instanceof FailedTransactionMetadata) {
  throw new Error('Signed transfer failed');
}

const balanceAfter = svm.getBalance(swigWalletAddress);
console.log(
  '💰 Balance after transfer:',
  balanceAfter !== null ? balanceAfter.toString() : 'Account not found',
);
