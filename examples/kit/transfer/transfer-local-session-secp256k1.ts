import {
  AccountRole,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';

import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';

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
} from '@swig-wallet/kit';

import { Wallet } from '@ethereumjs/wallet';

// ------------------ Helpers ------------------
const LAMPORTS_PER_SOL = 1_000_000_000n;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint,
) {
  const sig = await (rpc as any).requestAirdrop(to, lamports(amount)).send();
  // Nudge localnet to settle
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1200);
}

async function sendAndConfirmTransactionWithLogs(
  connection: {
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  instructions: IInstruction[],
  payer: KeyPairSigner,
  label: string,
): Promise<string> {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection as any)(signed, {
    commitment: 'confirmed',
  });

  const sig = getSignatureFromTransaction(signed).toString();
  console.log(
    `🔗 ${label}: https://explorer.solana.com/tx/${sig}?cluster=custom`,
  );
  return sig;
}

// ------------------ Main ------------------
(async () => {
  console.log('⏳ Starting on local validator...');

  // RPC Setup
  const rpc = createSolanaRpc('http://127.0.0.1:8899');
  const rpcSubscriptions = createSolanaRpcSubscriptions('ws://127.0.0.1:8900');
  const connection = { rpc, rpcSubscriptions };

  // Generate wallets and keypairs
  const userWallet = Wallet.generate();
  const userRootKeypair = await generateKeyPairSigner();
  const dappSessionKeypair = await generateKeyPairSigner();
  const dappTreasury = await generateKeyPairSigner();

  const id = Uint8Array.from({ length: 32 }, () => 0);
  const swigAccountAddress = await findSwigPda(id);

  // Airdrop SOL (confirm)
  await Promise.all([
    confirmAirdrop(rpc, userRootKeypair.address, 1n * LAMPORTS_PER_SOL),
    confirmAirdrop(rpc, dappSessionKeypair.address, 1n * LAMPORTS_PER_SOL),
  ]);

  // Create Swig
  const rootActions = Actions.set().all().get();

  // Secp256k1 authority with session capability
  const authorityInfo = createSecp256k1SessionAuthorityInfo(
    userWallet.getPublicKey(),
    100n, // Max session duration (slots) the authority may create
  );

  const createSwigInstruction = await getCreateSwigInstruction({
    authorityInfo,
    id,
    payer: userRootKeypair.address,
    actions: rootActions,
  });

  await sendAndConfirmTransactionWithLogs(
    connection,
    [createSwigInstruction],
    userRootKeypair,
    'CreateSwig',
  );

  // Fetch swig
  let swig = await fetchSwig(rpc, swigAccountAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('📦 Swig wallet address:', swigWalletAddress.toString());

  const rootRole = swig.findRoleById(0);
  if (!rootRole) throw new Error('Root role not found');

  // Use a finalized slot for session ops
  const currentSlot = BigInt(
    await rpc.getSlot({ commitment: 'finalized' }).send(),
  );
  const signingFn = getSigningFnForSecp256k1PrivateKey(
    userWallet.getPrivateKey(),
  );

  // Create session
  console.log('Creating session...');
  const sessionInstructions = await getCreateSessionInstructions(
    swig,
    rootRole.id,
    dappSessionKeypair.address,
    50n, // Session duration in slots
    {
      payer: userRootKeypair.address,
      currentSlot,
      signingFn,
    },
  );

  await sendAndConfirmTransactionWithLogs(
    connection,
    sessionInstructions,
    userRootKeypair,
    'CreateSession',
  );
  console.log('✅ Session created');

  // Refetch swig and get session role
  swig = await fetchSwig(rpc, swigAccountAddress);

  const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.address);
  if (!sessionRole) throw new Error('Session role not found');

  // Fund the SWIG wallet & confirm
  await confirmAirdrop(rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);

  console.log(
    '📦 Swig balance before transfer:',
    (await rpc.getBalance(swigWalletAddress).send()).value,
  );

  // Create transfer instruction (u64 as bigint)
  const TRANSFER_AMOUNT = 100_000_000n; // 0.1 SOL

  const transferIx = {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      { address: swigWalletAddress, role: AccountRole.WRITABLE_SIGNER },
      { address: dappTreasury.address, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({
        amount: TRANSFER_AMOUNT,
      }),
    ),
  } satisfies IInstruction;

  // Recompute a fresh finalized slot before signing
  const signSlot = BigInt(
    await rpc.getSlot({ commitment: 'finalized' }).send(),
  );

  const signTransferIxs = await getSignInstructions(
    swig,
    sessionRole.id,
    [transferIx],
    false,
    {
      payer: dappSessionKeypair.address,
      currentSlot: signSlot,
      signingFn,
    },
  );

  // Send signed transaction
  await sendAndConfirmTransactionWithLogs(
    connection,
    signTransferIxs,
    dappSessionKeypair,
    'TransferSOL',
  );

  console.log(
    '✅ Swig balance after transfer:',
    (await rpc.getBalance(swigWalletAddress).send()).value,
  );
})();
