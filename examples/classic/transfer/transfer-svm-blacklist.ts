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
  getCreateSwigInstructionBuilder,
  getSignInstructions,
  getSwigCodec,
  getSwigWalletAddress,
  getUpdateAuthorityInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  updateAuthorityAddActions,
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
console.log('starting subaccount example...');
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const rootAuthority = Keypair.generate();
svm.airdrop(rootAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

const spendAuthority = Keypair.generate();
svm.airdrop(spendAuthority.publicKey, BigInt(LAMPORTS_PER_SOL));

const id = Uint8Array.from(Array(32).fill(2));
const swigAccountAddress = findSwigPda(id);

const createSwigIxs = await getCreateSwigInstructionBuilder({
  payer: rootAuthority.publicKey,
  actions: Actions.set().all().get(),
  authorityInfo: createEd25519AuthorityInfo(rootAuthority.publicKey),
  id,
  swigAddress: swigAccountAddress,
  options: {},
})
  .addAuthority(
    createEd25519AuthorityInfo(spendAuthority.publicKey),
    Actions.set()
      .solLimit({ amount: BigInt(LAMPORTS_PER_SOL) })
      .get(),
  )
  .getInstructions();
sendSVMTransaction(svm, createSwigIxs, rootAuthority);

const swig = fetchSwig(svm, swigAccountAddress);

const swigWalletAddress = await getSwigWalletAddress(swig);
svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));

console.log('wallet balance:', svm.getBalance(swigWalletAddress));

const rootAuthorityRole = swig.roles[0];
const spendAuthorityRole = swig.roles[1];

const recipient = Keypair.generate().publicKey;

let transfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: recipient,
  lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
});

let signIx = await getSignInstructions(swig, spendAuthorityRole.id, [transfer]);
sendSVMTransaction(svm, signIx, spendAuthority);

console.log('new wallet balance balance:', svm.getBalance(swigWalletAddress));
console.log('recipient balance:', svm.getBalance(recipient));

await swig.refetch();

// blacklist old recipient
const updateAuthorityIxs = await getUpdateAuthorityInstructions(
  swig,
  rootAuthorityRole.id,
  spendAuthorityRole.id,
  updateAuthorityAddActions(
    Actions.set()
      .blacklist({
        entityId: recipient,
        entityType: 'wallet',
      })
      .get(),
  ),
);

sendSVMTransaction(svm, updateAuthorityIxs, rootAuthority);

transfer = SystemProgram.transfer({
  fromPubkey: swigWalletAddress,
  toPubkey: recipient,
  lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
});

signIx = await getSignInstructions(swig, spendAuthorityRole.id, [transfer]);
sendSVMTransaction(svm, signIx, spendAuthority);

console.log('new wallet balance balance:', svm.getBalance(swigWalletAddress));
console.log('recipient balance:', svm.getBalance(recipient));
