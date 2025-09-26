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
  Swig,
  SWIG_PROGRAM_ADDRESS,
} from '@swig-wallet/classic';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { readFileSync } from 'node:fs';

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

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
    throw new Error(`Transaction failed: ${tx.meta().logs().join(', ')}`);
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
  }
}

function fetchSwig(
  svm: LiteSVM,
  swigAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = svm.getAccount(swigAddress);
  if (!swigAccount) throw new Error('swig account not created');
  const accountData = Uint8Array.from(swigAccount.data);
  return Swig.fromRawAccountData(swigAddress, accountData);
}

console.log('starting...');

(async () => {
  // Initialize LiteSVM with swig program
  const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
  const svm = new LiteSVM();
  svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

  // Create and fund root keypair
  const rootKeypair = Keypair.generate();
  svm.airdrop(rootKeypair.publicKey, BigInt(2 * LAMPORTS_PER_SOL));

  // Create Swig root account
  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);

  console.log('swig address:', swigAddress.toBase58());

  const rootActions = Actions.set().all().get();
  const ix = await getCreateSwigInstruction({
    actions: rootActions,
    id: swigId,
    authorityInfo: createEd25519AuthorityInfo(rootKeypair.publicKey),
    payer: rootKeypair.publicKey,
  });

  sendSVMTransaction(svm, [ix], rootKeypair);

  // Fetch root role
  let swig = fetchSwig(svm, swigAddress);
  const rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  // Create role that can only send 1 SOL to recipient
  const recipient = Keypair.generate();
  console.log('Recipient:', recipient.publicKey.toBase58());

  const roleKeypair = Keypair.generate();
  const actions = Actions.set()
    .solDestinationLimit({
      amount: BigInt(1 * LAMPORTS_PER_SOL),
      destination: recipient.publicKey,
    })
    .get();

  const addIx = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(roleKeypair.publicKey),
    actions,
  );

  sendSVMTransaction(svm, addIx, rootKeypair);

  // Refresh swig to get the newly added role
  swig = fetchSwig(svm, swigAddress);

  // Fund the swig account so it can make transfers
  svm.airdrop(swigAddress, BigInt(2 * LAMPORTS_PER_SOL));

  // Fund the role keypair for transaction fees
  svm.airdrop(roleKeypair.publicKey, BigInt(0.1 * LAMPORTS_PER_SOL));

  // Check balance to ensure funding was successful
  const swigBalance = svm.getBalance(swigAddress);
  console.log(
    `Swig account balance: ${Number(swigBalance) / LAMPORTS_PER_SOL} SOL`,
  );

  if (swigBalance === BigInt(0)) {
    throw new Error('Failed to fund Swig account');
  }

  console.log('balance before transfer:', svm.getBalance(swigAddress));

  // Build the transfer
  const transferIx = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: recipient.publicKey,
    lamports: 1 * LAMPORTS_PER_SOL,
  });

  // Let the role authority sign through the Swig account
  const roleFromSwig = swig.findRolesByEd25519SignerPk(
    roleKeypair.publicKey,
  )[0];
  if (!roleFromSwig) throw new Error('Role not found');

  const signedInstructions = await getSignInstructions(swig, roleFromSwig.id, [
    transferIx,
  ]);

  // Send transaction
  sendSVMTransaction(svm, signedInstructions, roleKeypair);

  console.log(
    'balance after authorized transfer:',
    svm.getBalance(swigAddress),
  );
  console.log('Swig role successfully sent 1 SOL to authorized recipient!');

  // Refresh swig after transfer
  swig = fetchSwig(svm, swigAddress);

  // Test unauthorized transfer to a different destination
  const unauthorizedRecipient = Keypair.generate();
  console.log(
    'Unauthorized recipient:',
    unauthorizedRecipient.publicKey.toBase58(),
  );

  try {
    const unauthorizedTransferIx = SystemProgram.transfer({
      fromPubkey: swigAddress,
      toPubkey: unauthorizedRecipient.publicKey,
      lamports: 1 * LAMPORTS_PER_SOL,
    });

    const unauthorizedSignedInstructions = await getSignInstructions(
      swig,
      roleFromSwig.id,
      [unauthorizedTransferIx],
    );

    sendSVMTransaction(svm, unauthorizedSignedInstructions, roleKeypair);
    throw new Error(
      'Unauthorized transfer succeeded - this should not happen!',
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('should not happen')) {
      throw error;
    }
    console.log(
      'Unauthorized transfer correctly rejected:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
})();
