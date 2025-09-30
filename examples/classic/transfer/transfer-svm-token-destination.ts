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
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
} from '@swig-wallet/classic';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import { SolPublicKey, type SwigFetchFn } from '@swig-wallet/lib';
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
    fetchSwigAccount(
      svm,
      new PublicKey(new SolPublicKey(swigAccountAddress).toBytes()),
    );
  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
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
  const swigAccountAddress = findSwigPda(swigId);

  console.log('swig address:', swigAccountAddress.toBase58());

  const rootActions = Actions.set().all().get();
  const ix = await getCreateSwigInstruction({
    actions: rootActions,
    id: swigId,
    authorityInfo: createEd25519AuthorityInfo(rootKeypair.publicKey),
    payer: rootKeypair.publicKey,
  });

  sendSVMTransaction(svm, [ix], rootKeypair);

  // Fetch root role
  let swig = fetchSwig(svm, swigAccountAddress);
  const rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  // Get the Swig wallet address
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('swig wallet address:', swigWalletAddress.toBase58());

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
    swigWalletAddress,
    true,
  );

  const createSwigAtaIx = createAssociatedTokenAccountInstruction(
    rootKeypair.publicKey,
    swigAta,
    swigWalletAddress,
    mintKeypair.publicKey,
  );

  sendSVMTransaction(svm, [createSwigAtaIx], rootKeypair);

  // Mint tokens to Swig ATA
  const mintAmount = BigInt(1000 * 10 ** decimals);
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

  // Create role that can only send up to 200 tokens to specific recipient
  const roleKeypair = Keypair.generate();
  const tokenLimitAmount = BigInt(200 * 10 ** decimals);
  const tokenTransferAmount = BigInt(100 * 10 ** decimals);

  console.log('Transfer amount (raw):', tokenTransferAmount.toString());
  console.log(
    'Transfer amount (tokens):',
    Number(tokenTransferAmount) / 10 ** decimals,
  );

  console.log('Setting up tokenDestinationLimit with:');
  console.log('  mint:', mintKeypair.publicKey.toBase58());
  console.log('  destination:', recipientAta.toBase58());
  console.log('  amount:', tokenTransferAmount.toString());

  const actions = Actions.set()
    .tokenDestinationLimit({
      mint: mintKeypair.publicKey,
      amount: tokenLimitAmount,
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
  swig = fetchSwig(svm, swigAccountAddress);

  // Debug: Check the role configuration
  const debugRole = swig.findRolesByEd25519SignerPk(roleKeypair.publicKey)[0];
  console.log('Role found:', !!debugRole);
  console.log('Role ID:', debugRole?.id.toString());

  // Fund the role keypair for transaction fees
  svm.airdrop(roleKeypair.publicKey, BigInt(0.1 * LAMPORTS_PER_SOL));

  // Check token balance before transfer
  const swigAtaAccountBefore = svm.getAccount(swigAta);
  console.log(
    'Swig ATA balance before transfer:',
    swigAtaAccountBefore ? 'funded' : 'not found',
  );

  // Build the token transfer
  console.log('Creating transfer instruction with:');
  console.log('  source:', swigAta.toBase58());
  console.log('  destination:', recipientAta.toBase58());
  console.log('  owner:', swigAccountAddress.toBase58());
  console.log('  amount:', tokenTransferAmount.toString());

  const transferIx = createTransferInstruction(
    swigAta,
    recipientAta,
    swigWalletAddress,
    tokenTransferAmount,
  );

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
    'Swig role successfully sent 100 tokens to authorized recipient!',
  );

  // Refresh swig after transfer
  swig = fetchSwig(svm, swigAccountAddress);

  // Test unauthorized transfer to a different destination
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
      swigWalletAddress,
      tokenTransferAmount,
    );

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
