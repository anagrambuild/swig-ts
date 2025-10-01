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
  getSwigWalletAddress,
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
      `🔍 Explorer: https://explorer.solana.com/tx/${signature}?cluster=custom`,
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

  // fund root
  const rootKeypair = Keypair.generate();
  await connection.requestAirdrop(rootKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
  await sleep(2);

  // create Swig root account
  const swigId = randomBytes(32);
  const swigAccountAddress = findSwigPda(swigId);

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

  // fetch root role
  const swig = await fetchSwig(connection, swigAccountAddress);
  const rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  // create role that can only send 1 SOL to recipient
  const recipient = Keypair.generate();
  console.log('💳 Recipient:', recipient.publicKey.toBase58());

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

  tx = new Transaction().add(...addIx);
  await sendTransaction(connection, tx, rootKeypair);
  console.log('👤 Added role authority');
  await sleep(5);

  // refresh swig to get the newly added role
  await swig.refetch();

  // get the swig wallet address
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('🏦 Swig wallet address:', swigWalletAddress.toBase58());

  // fund the swig wallet so it can make transfers
  await connection.requestAirdrop(swigWalletAddress, 2 * LAMPORTS_PER_SOL);

  // fund the role keypair for transaction fees and rent exemption
  await connection.requestAirdrop(
    roleKeypair.publicKey,
    0.1 * LAMPORTS_PER_SOL,
  );
  await sleep(5);

  // check balance to ensure funding was successful
  const swigBalance = await connection.getBalance(swigWalletAddress);
  console.log(`💰 Swig wallet balance: ${swigBalance / LAMPORTS_PER_SOL} SOL`);

  if (swigBalance === 0) {
    throw new Error('Failed to fund Swig wallet');
  }

  // now build the transfer
  const transferIx = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: recipient.publicKey,
    lamports: 1 * LAMPORTS_PER_SOL,
  });

  // let the role authority sign through the Swig account
  const roleFromSwig = swig.findRolesByEd25519SignerPk(
    roleKeypair.publicKey,
  )[0];
  if (!roleFromSwig) throw new Error('Role not found');

  const signedInstructions = await getSignInstructions(swig, roleFromSwig.id, [
    transferIx,
  ]);

  // send transaction (fee payer is roleKeypair, with rootKeypair as additional signer for fees)
  await sendTransaction(connection, signedInstructions, roleKeypair, []);

  console.log('🎉 Swig role successfully sent 1 SOL to recipient!');

  // Test unauthorized transfer to a different destination
  const unauthorizedRecipient = Keypair.generate();
  console.log(
    '🚫 Unauthorized recipient:',
    unauthorizedRecipient.publicKey.toBase58(),
  );

  try {
    const unauthorizedTransferIx = SystemProgram.transfer({
      fromPubkey: swigWalletAddress,
      toPubkey: unauthorizedRecipient.publicKey,
      lamports: 1 * LAMPORTS_PER_SOL,
    });

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
