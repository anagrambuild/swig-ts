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
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
} from '@swig-wallet/classic';

function sleep(s: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

async function sendTransaction(
  connection: Connection,
  instruction: any[] | Transaction,
  payer: Keypair,
  signers: Keypair[] = [],
) {
  const transaction = Array.isArray(instruction)
    ? new Transaction().add(...instruction)
    : instruction;

  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;

  transaction.sign(payer, ...signers);

  try {
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
    );
    await connection.confirmTransaction({
      signature,
      ...(await connection.getLatestBlockhash()),
    });
    console.log('✅ Transaction confirmed:', signature);
    console.log(
      `🔍 Explorer: http://localhost:3000/tx/${signature}?cluster=custom`,
    );
    return signature;
  } catch (error: any) {
    if (error.logs) {
      console.log('❌ Transaction logs:', error.logs);
    }
    throw error;
  }
}

(async () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Fund root keypair
  const rootKeypair = Keypair.generate();
  await connection.requestAirdrop(rootKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
  await sleep(2);

  // Create Swig root account
  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);

  const rootActions = Actions.set().all().get();
  const ix = await getCreateSwigInstruction({
    actions: rootActions,
    id: swigId,
    authorityInfo: createEd25519AuthorityInfo(rootKeypair.publicKey),
    payer: rootKeypair.publicKey,
  });

  let tx = new Transaction().add(ix);
  await sendTransaction(connection, tx, rootKeypair);
  await sleep(2);

  // Fetch root role
  const swig = await fetchSwig(connection, swigAddress);
  const rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  // Create SPL token mint
  const mintKeypair = Keypair.generate();
  const decimals = 6;

  // Fund mint account creation
  const mintLamports = await connection.getMinimumBalanceForRentExemption(
    getMintLen([]),
  );

  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: rootKeypair.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    lamports: mintLamports,
    space: getMintLen([]),
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,
    rootKeypair.publicKey,
    rootKeypair.publicKey,
  );

  await sendTransaction(
    connection,
    [createMintAccountIx, initMintIx],
    rootKeypair,
    [mintKeypair],
  );

  console.log('🪙 Token mint created:', mintKeypair.publicKey.toBase58());

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

  await sendTransaction(connection, [createSwigAtaIx], rootKeypair);

  // Mint tokens to Swig ATA
  const mintAmount = BigInt(1000 * 10 ** decimals);
  const mintToSwigIx = createMintToInstruction(
    mintKeypair.publicKey,
    swigAta,
    rootKeypair.publicKey,
    mintAmount,
  );

  await sendTransaction(connection, [mintToSwigIx], rootKeypair);

  console.log(
    `💧 Minted ${Number(mintAmount) / 10 ** decimals} tokens to Swig ATA`,
  );

  // Create recipient and their ATA
  const recipient = Keypair.generate();
  console.log('💳 Recipient:', recipient.publicKey.toBase58());

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

  await sendTransaction(connection, [createRecipientAtaIx], rootKeypair);

  console.log('🏦 Recipient ATA:', recipientAta.toBase58());

  // Create role that can only send 100 tokens to specific recipient
  const roleKeypair = Keypair.generate();
  const tokenTransferAmount = BigInt(100 * 10 ** decimals);

  const actions = Actions.set()
    .tokenDestinationLimit({
      mint: mintKeypair.publicKey,
      amount: tokenTransferAmount,
      destination: recipient.publicKey,
    })
    .get();

  const addIx = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(roleKeypair.publicKey),
    actions,
  );

  tx = new Transaction().add(...addIx);
  await sendTransaction(connection, tx, rootKeypair);
  console.log('👤 Added role authority with token destination limit');
  await sleep(5);

  // Refresh swig to get the newly added role
  await swig.refetch();

  // Fund the role keypair for transaction fees
  await connection.requestAirdrop(
    roleKeypair.publicKey,
    0.1 * LAMPORTS_PER_SOL,
  );
  await sleep(5);

  // Check token balance before transfer
  const swigAtaBalanceBefore = await connection.getTokenAccountBalance(swigAta);
  console.log(
    `💰 Swig ATA balance before transfer: ${swigAtaBalanceBefore.value.uiAmount} tokens`,
  );

  // Build the token transfer
  const transferIx = createTransferInstruction(
    swigAta,
    recipientAta,
    swigAddress,
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
  await sendTransaction(connection, signedInstructions, roleKeypair, []);

  console.log(
    '🎉 Swig role successfully sent 100 tokens to authorized recipient!',
  );

  // Check balances after transfer
  const swigAtaBalanceAfter = await connection.getTokenAccountBalance(swigAta);
  const recipientAtaBalance =
    await connection.getTokenAccountBalance(recipientAta);
  console.log(
    `💰 Swig ATA balance after transfer: ${swigAtaBalanceAfter.value.uiAmount} tokens`,
  );
  console.log(
    `💰 Recipient ATA balance: ${recipientAtaBalance.value.uiAmount} tokens`,
  );

  // Refresh swig after transfer
  await swig.refetch();

  // Test unauthorized transfer to a different destination
  const unauthorizedRecipient = Keypair.generate();
  console.log(
    '🚫 Unauthorized recipient:',
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

  await sendTransaction(connection, [createUnauthorizedAtaIx], rootKeypair);

  try {
    const unauthorizedTransferIx = createTransferInstruction(
      swigAta,
      unauthorizedAta,
      swigAddress,
      tokenTransferAmount,
    );

    const unauthorizedSignedInstructions = await getSignInstructions(
      swig,
      roleFromSwig.id,
      [unauthorizedTransferIx],
    );

    await sendTransaction(
      connection,
      unauthorizedSignedInstructions,
      roleKeypair,
    );
    throw new Error(
      'Unauthorized transfer succeeded - this should not happen!',
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('should not happen')) {
      throw error;
    }
    console.log(
      '✅ Unauthorized transfer correctly rejected:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
})();
