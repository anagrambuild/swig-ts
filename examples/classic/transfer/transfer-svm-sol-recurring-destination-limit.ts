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
    fetchSwigAccount(svm, toPublicKey(swigAddress));
  return new Swig(swigAddress, swigAccount, swigFetchFn);
}

console.log('starting...');

(async () => {
  // Initialize LiteSVM with swig program
  const swigProgram = Uint8Array.from(readFileSync('../../../swig.so'));
  const svm = new LiteSVM();
  svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);

  // Create and fund root keypair
  const rootKeypair = Keypair.generate();
  svm.airdrop(rootKeypair.publicKey, BigInt(5 * LAMPORTS_PER_SOL));

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

  // Create recipient
  const recipient = Keypair.generate();
  console.log('Recipient:', recipient.publicKey.toBase58());

  // Create role with recurring destination limit: 0.5 SOL per window to specific recipient
  const roleKeypair = Keypair.generate();
  const recurringAmount = BigInt(0.5 * LAMPORTS_PER_SOL);
  const window = BigInt(100); // 100 slots window for testing

  const actions = Actions.set()
    .solRecurringDestinationLimit({
      recurringAmount,
      window,
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
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('swig wallet address:', swigWalletAddress.toBase58());

  // Fund the swig wallet address and role keypair
  svm.airdrop(swigWalletAddress, BigInt(5 * LAMPORTS_PER_SOL));
  svm.airdrop(roleKeypair.publicKey, BigInt(0.1 * LAMPORTS_PER_SOL));

  // Check balance before transfers
  console.log('balance before transfers:', svm.getBalance(swigWalletAddress));

  // First transfer: 0.3 SOL (within limit)
  const transferAmount1 = BigInt(0.3 * LAMPORTS_PER_SOL);
  const transferIx1 = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: recipient.publicKey,
    lamports: transferAmount1,
  });

  const roleFromSwig = swig.findRolesByEd25519SignerPk(
    roleKeypair.publicKey,
  )[0];
  if (!roleFromSwig) throw new Error('Role not found');

  const signedInstructions1 = await getSignInstructions(swig, roleFromSwig.id, [
    transferIx1,
  ]);

  sendSVMTransaction(svm, signedInstructions1, roleKeypair);

  console.log(
    'balance after first transfer (0.3 SOL):',
    svm.getBalance(swigWalletAddress),
  );

  // Refresh swig after first transfer
  swig = fetchSwig(svm, swigAddress);

  // Second transfer: 0.2 SOL (should still be allowed, total 0.5 SOL)
  const transferAmount2 = BigInt(0.2 * LAMPORTS_PER_SOL);
  const transferIx2 = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: recipient.publicKey,
    lamports: transferAmount2,
  });

  const roleFromSwig2 = swig.findRolesByEd25519SignerPk(
    roleKeypair.publicKey,
  )[0];
  if (!roleFromSwig2) throw new Error('Role not found');

  const signedInstructions2 = await getSignInstructions(
    swig,
    roleFromSwig2.id,
    [transferIx2],
  );

  sendSVMTransaction(svm, signedInstructions2, roleKeypair);

  console.log(
    'balance after second transfer (0.2 SOL, total 0.5 SOL):',
    svm.getBalance(swigWalletAddress),
  );
  console.log('Successfully sent recurring transfers to authorized recipient!');

  // Refresh swig after second transfer
  swig = fetchSwig(svm, swigAddress);

  // Third transfer: 0.1 SOL (should exceed the 0.5 SOL limit in current window)
  try {
    const transferAmount3 = BigInt(0.1 * LAMPORTS_PER_SOL);
    const transferIx3 = SystemProgram.transfer({
      fromPubkey: swigWalletAddress,
      toPubkey: recipient.publicKey,
      lamports: transferAmount3,
    });

    const roleFromSwig3 = swig.findRolesByEd25519SignerPk(
      roleKeypair.publicKey,
    )[0];
    if (!roleFromSwig3) throw new Error('Role not found');

    const signedInstructions3 = await getSignInstructions(
      swig,
      roleFromSwig3.id,
      [transferIx3],
    );

    sendSVMTransaction(svm, signedInstructions3, roleKeypair);
    throw new Error('Third transfer succeeded - this should not happen!');
  } catch (error) {
    if (error instanceof Error && error.message.includes('should not happen')) {
      throw error;
    }
    console.log(
      'Third transfer correctly rejected (exceeds recurring limit):',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  // Test unauthorized transfer to different destination
  const unauthorizedRecipient = Keypair.generate();
  console.log(
    'Unauthorized recipient:',
    unauthorizedRecipient.publicKey.toBase58(),
  );

  try {
    const unauthorizedTransferIx = SystemProgram.transfer({
      fromPubkey: swigWalletAddress,
      toPubkey: unauthorizedRecipient.publicKey,
      lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
    });

    const roleFromSwig4 = swig.findRolesByEd25519SignerPk(
      roleKeypair.publicKey,
    )[0];
    if (!roleFromSwig4) throw new Error('Role not found');

    const unauthorizedSignedInstructions = await getSignInstructions(
      swig,
      roleFromSwig4.id,
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
      'Unauthorized transfer correctly rejected (wrong destination):',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
})();
