import { Wallet } from '@ethereumjs/wallet';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createSecp256k1SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
  type InstructionDataOptions,
} from '@swig-wallet/classic';

//
// Helpers
//
async function sendAndConfirmTransactionWithLogs(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  label: string,
) {
  const tx = new Transaction().add(...instructions);
  tx.feePayer = signers[0].publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(...signers);

  const sig = await sendAndConfirmTransaction(connection, tx, signers, {
    commitment: 'confirmed',
  });

  console.log(
    `🔗 ${label}: https://explorer.solana.com/tx/${sig}?cluster=custom`,
  );
  return sig;
}

(async () => {
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
  console.log('⏳ Starting on local validator...');

  const userWallet = Wallet.generate();
  const userRootKeypair = Keypair.generate();
  const dappSessionKeypair = Keypair.generate();
  const dappTreasury = Keypair.generate().publicKey;

  const id = Uint8Array.from(Array(32).fill(0));
  const swigAddress = findSwigPda(id);
  console.log('📌 Swig PDA:', swigAddress.toBase58());

  // Airdrop SOL
  for (const keypair of [userRootKeypair, dappSessionKeypair]) {
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig, 'confirmed');
  }

  // Create Swig with session-capable Secp256k1 root
  const rootActions = Actions.set().all().get();
  const createSwigInstruction = await getCreateSwigInstruction({
    authorityInfo: createSecp256k1SessionAuthorityInfo(
      userWallet.getPublicKey(),
      100n, // root session limit
    ),
    id,
    payer: userRootKeypair.publicKey,
    actions: rootActions,
  });

  await sendAndConfirmTransactionWithLogs(
    connection,
    [createSwigInstruction],
    [userRootKeypair],
    'CreateSwig',
  );

  // Fetch Swig
  const swig = await fetchSwig(connection, swigAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('🏦 Swig Wallet:', swigWalletAddress.toBase58());

  const rootRole = swig.findRoleById(0);
  if (!rootRole) throw new Error('Root role not found');
  console.log('🔑 Root role id:', rootRole.id.toString());

  const currentSlot = await connection.getSlot('confirmed');
  const signingFn = getSigningFnForSecp256k1PrivateKey(
    userWallet.getPrivateKey(),
  );

  const instOptions: InstructionDataOptions = {
    currentSlot: BigInt(currentSlot),
    signingFn,
  };

  // Create a session role for the dapp
  const sessionInstructions = await getCreateSessionInstructions(
    swig,
    rootRole.id,
    dappSessionKeypair.publicKey,
    50n, // session spend limit
    { ...instOptions, payer: userRootKeypair.publicKey },
  );

  await sendAndConfirmTransactionWithLogs(
    connection,
    sessionInstructions,
    [userRootKeypair],
    'CreateSession',
  );

  // Refetch Swig and locate session role
  await swig.refetch();
  const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey);
  if (!sessionRole) throw new Error('Session role not found');
  console.log('🪪 Session role id:', sessionRole.id.toString());

  // Fund the Swig wallet
  const sig = await connection.requestAirdrop(
    swigWalletAddress,
    LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(sig, 'confirmed');
  console.log(
    '📦 Swig balance before transfer:',
    await connection.getBalance(swigWalletAddress),
  );

  // Prepare SOL transfer
  const lamports = BigInt(0.1 * LAMPORTS_PER_SOL);
  const transferIx = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: dappTreasury,
    lamports,
  });

  const signTransfer = await getSignInstructions(
    swig,
    sessionRole.id,
    [transferIx],
    false,
    {
      ...instOptions,
      payer: dappSessionKeypair.publicKey,
    },
  );

  try {
    await sendAndConfirmTransactionWithLogs(
      connection,
      signTransfer,
      [dappSessionKeypair],
      'TransferSOL',
    );
  } catch (err) {
    if (err instanceof SendTransactionError) {
      console.error('🚨 Simulation failed:', err.message);
      const logs = await err.getLogs(connection);
      if (logs) console.error(logs.join('\n'));
    } else {
      console.error('Unexpected error:', err);
    }
    return;
  }

  console.log(
    '✅ Swig balance after transfer:',
    await connection.getBalance(swigWalletAddress),
  );
})();
