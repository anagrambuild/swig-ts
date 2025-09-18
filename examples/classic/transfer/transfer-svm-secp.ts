import { Wallet } from '@ethereumjs/wallet';
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
  createSecp256k1AuthorityInfo,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  type InstructionDataOptions,
} from '@swig-wallet/classic';
import { LiteSVM, FailedTransactionMetadata } from 'litesvm';
import { readFileSync } from 'node:fs';

function sendSVMTransaction(svm: LiteSVM, ixs: TransactionInstruction[], payer: Keypair) {
  svm.expireBlockhash();
  const tx = new Transaction();
  tx.instructions = ixs;
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(payer);

  const res = svm.sendTransaction(tx);
  if (res instanceof FailedTransactionMetadata) {
    console.log('❌ logs:', res.meta().logs());
  }
  return res;
}

function fetchSwig(svm: LiteSVM, addr: PublicKey) {
  const acc = svm.getAccount(addr);
  if (!acc) throw new Error('swig not created');
  return Swig.fromRawAccountData(addr, Uint8Array.from(acc.data));
}

console.log('starting authority-secp256k1...');
const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
const svm = new LiteSVM();
svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

const wallet = Wallet.generate();
const root = Keypair.generate();
svm.airdrop(root.publicKey, BigInt(LAMPORTS_PER_SOL));

const manager = Keypair.generate();
svm.airdrop(manager.publicKey, BigInt(LAMPORTS_PER_SOL));

const treasury = Keypair.generate().publicKey;
const id = Uint8Array.from(Array(32).fill(0));
const swigAddress = findSwigPda(id);

// create swig
const rootActions = Actions.set().all().get();
const createIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(wallet.getPublicKey()),
  id,
  payer: root.publicKey,
  actions: rootActions,
});
sendSVMTransaction(svm, [createIx], root);

let swig = fetchSwig(svm, swigAddress);
const role = swig.findRolesBySecp256k1SignerAddress(wallet.getAddress())[0]!;
const slot = svm.getClock().slot;

const signingFn = getSigningFnForSecp256k1PrivateKey(wallet.getPrivateKey());
const opts: InstructionDataOptions = { currentSlot: slot, signingFn };

svm.airdrop(swigAddress, BigInt(LAMPORTS_PER_SOL));
swig = fetchSwig(svm, swigAddress);

console.log('balance before:', svm.getBalance(swigAddress));

const transfer = SystemProgram.transfer({
  fromPubkey: swigAddress,
  toPubkey: treasury,
  lamports: Math.floor(0.1 * LAMPORTS_PER_SOL),
});
const signIx = await getSignInstructions(swig, role.id, [transfer], false, {
  ...opts,
  payer: manager.publicKey,
});
sendSVMTransaction(svm, signIx, manager);

console.log('balance after:', svm.getBalance(swigAddress));
