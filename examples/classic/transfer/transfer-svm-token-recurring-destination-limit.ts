import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
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
  signers: Keypair[] = [],
) {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer, ...signers);

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

  // Create SPL token mint
  const mintKeypair = Keypair.generate();
  const decimals = 6;

  // Fund mint account creation
  const mintLamports = svm.minimumBalanceForRentExemption(
    BigInt(getMintLen([])),
  );

  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: rootKeypair.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    lamports: Number(mintLamports),
    space: getMintLen([]),
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,
    rootKeypair.publicKey,
    rootKeypair.publicKey,
  );

  sendSVMTransaction(svm, [createMintAccountIx, initMintIx], rootKeypair, [
    mintKeypair,
  ]);

  console.log('Token mint created:', mintKeypair.publicKey.toBase58());

  // Create Swig ATA
  const swigAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    swigAddress,
    true,
  );

  const createSwigAtaIx = createAssociatedTokenAccountInstruction(
    rootKeypair.publicKey,
    swigAta,
    swigAddress,
    mintKeypair.publicKey,
  );

  sendSVMTransaction(svm, [createSwigAtaIx], rootKeypair);

  // Mint tokens to Swig ATA
  const mintAmount = BigInt(10000 * 10 ** decimals);
  const mintToSwigIx = createMintToInstruction(
    mintKeypair.publicKey,
    swigAta,
    rootKeypair.publicKey,
    mintAmount,
  );

  sendSVMTransaction(svm, [mintToSwigIx], rootKeypair);

  console.log(
    `Minted ${Number(mintAmount) / 10 ** decimals} tokens to Swig ATA`,
  );

  // Create recipient and their ATA
  const recipient = Keypair.generate();
  console.log('Recipient:', recipient.publicKey.toBase58());

  const recipientAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    recipient.publicKey,
  );

  const createRecipientAtaIx = createAssociatedTokenAccountInstruction(
    rootKeypair.publicKey,
    recipientAta,
    recipient.publicKey,
    mintKeypair.publicKey,
  );

  sendSVMTransaction(svm, [createRecipientAtaIx], rootKeypair);

  console.log('Recipient ATA:', recipientAta.toBase58());

  // Create role with recurring token destination limit: 600 tokens per window to specific recipient
  const roleKeypair = Keypair.generate();
  const recurringAmount = BigInt(600 * 10 ** decimals);
  const window = BigInt(100); // 100 slots window for testing

  const actions = Actions.set()
    .tokenRecurringDestinationLimit({
      mint: mintKeypair.publicKey,
      recurringAmount,
      window,
      destination: recipientAta,
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

  // Fund the role keypair for transaction fees
  svm.airdrop(roleKeypair.publicKey, BigInt(0.1 * LAMPORTS_PER_SOL));

  // Check token balance before transfers
  const swigAtaAccountBefore = svm.getAccount(swigAta);
  console.log(
    'Swig ATA balance before transfers:',
    swigAtaAccountBefore ? 'funded' : 'not found',
  );

  // First transfer: 200 tokens (within limit)
  const transferAmount1 = BigInt(200 * 10 ** decimals);
  const transferIx1 = createTransferInstruction(
    swigAta,
    recipientAta,
    swigAddress,
    transferAmount1,
  );

  const roleFromSwig = swig.findRolesByEd25519SignerPk(
    roleKeypair.publicKey,
  )[0];
  if (!roleFromSwig) throw new Error('Role not found');

  const signedInstructions1 = await getSignInstructions(swig, roleFromSwig.id, [
    transferIx1,
  ]);

  sendSVMTransaction(svm, signedInstructions1, roleKeypair);

  console.log('First transfer completed: 200 tokens');

  // Refresh swig after first transfer
  swig = fetchSwig(svm, swigAddress);

  // Second transfer: 300 tokens (should still be allowed, total 500 tokens)
  const transferAmount2 = BigInt(300 * 10 ** decimals);
  const transferIx2 = createTransferInstruction(
    swigAta,
    recipientAta,
    swigAddress,
    transferAmount2,
  );

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

  console.log('Second transfer completed: 300 tokens (total 500 tokens)');
  console.log(
    'Successfully sent recurring token transfers to authorized recipient!',
  );

  // Refresh swig after second transfer
  swig = fetchSwig(svm, swigAddress);

  // Third transfer: 100 tokens (should exceed the 500 token limit in current window)
  try {
    const transferAmount3 = BigInt(100 * 10 ** decimals);
    const transferIx3 = createTransferInstruction(
      swigAta,
      recipientAta,
      swigAddress,
      transferAmount3,
    );

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

  const unauthorizedAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    unauthorizedRecipient.publicKey,
  );

  const createUnauthorizedAtaIx = createAssociatedTokenAccountInstruction(
    rootKeypair.publicKey,
    unauthorizedAta,
    unauthorizedRecipient.publicKey,
    mintKeypair.publicKey,
  );

  sendSVMTransaction(svm, [createUnauthorizedAtaIx], rootKeypair);

  try {
    const unauthorizedTransferIx = createTransferInstruction(
      swigAta,
      unauthorizedAta,
      swigAddress,
      BigInt(50 * 10 ** decimals),
    );

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
