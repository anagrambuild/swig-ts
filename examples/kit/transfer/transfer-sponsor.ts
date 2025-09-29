import {
  addSignersToTransactionMessage,
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
} from '@solana/kit';

import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

import { getCreateAccountInstruction } from '@solana-program/system';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

// ---------------- helpers ----------------
const LAMPORTS_PER_SOL = 1_000_000_000n;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint,
) {
  const sig = await (rpc as any).requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1200);
}

async function sendTx(instructions: any[], feePayer: any, signers: any[] = []) {
  const { value: blockhash } = await connection.rpc.getLatestBlockhash().send();

  const tx = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );

  const signed = await signTransactionMessageWithSigners(tx);
  await sendAndConfirmTransactionFactory(connection)(signed, {
    commitment: 'confirmed',
  });
  return getSignatureFromTransaction(signed).toString();
}

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

// ---------------- setup ----------------
const connection = {
  rpc: createSolanaRpc('http://localhost:8899'),
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://localhost:8900'),
};

const DECIMALS = 6;

// ---------------- main ----------------
(async () => {
  const userRoot = await generateKeyPairSigner();
  const userMgr = await generateKeyPairSigner();
  const devWallet = await generateKeyPairSigner();
  const usdcMint = await generateKeyPairSigner();
  const recipient = await generateKeyPairSigner();

  // Fund accounts (no sleeps)
  await Promise.all([
    confirmAirdrop(connection.rpc, userRoot.address, LAMPORTS_PER_SOL),
    confirmAirdrop(connection.rpc, userMgr.address, LAMPORTS_PER_SOL),
    confirmAirdrop(connection.rpc, devWallet.address, LAMPORTS_PER_SOL),
    confirmAirdrop(connection.rpc, recipient.address, LAMPORTS_PER_SOL),
  ]);

  // Swig setup
  const id = randomBytes(32);
  const swigAddr = await findSwigPda(id);

  const swigIx = await getCreateSwigInstruction({
    payer: userRoot.address,
    id,
    authorityInfo: createEd25519AuthorityInfo(userRoot.address),
    actions: Actions.set().all().get(),
  });
  await sendTx([swigIx], userRoot);

  const swig = await fetchSwig(connection.rpc, swigAddr);

  // Get the Swig wallet address
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('swig wallet address:', swigWalletAddress);

  const mgrIxs = await getAddAuthorityInstructions(
    swig,
    swig.findRolesByEd25519SignerPk(userRoot.address)[0].id,
    createEd25519AuthorityInfo(userMgr.address),
    Actions.set().manageAuthority().get(),
    { payer: userRoot.address },
  );
  await sendTx(mgrIxs, userRoot);
  await swig.refetch();

  // ----- Mint USDC-like token -----
  const mintSize = BigInt(getMintSize());
  const rent = await connection.rpc
    .getMinimumBalanceForRentExemption(mintSize)
    .send();

  const createMintIx = getCreateAccountInstruction({
    payer: devWallet,
    newAccount: usdcMint,
    lamports: rent,
    space: mintSize,
    programAddress: TOKEN_PROGRAM_ADDRESS,
  });

  const initMintIx = getInitializeMintInstruction({
    mint: usdcMint.address,
    decimals: DECIMALS,
    mintAuthority: devWallet.address,
  });

  const [swigAta] = await findAssociatedTokenPda({
    mint: usdcMint.address,
    owner: swigWalletAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const [recipAta] = await findAssociatedTokenPda({
    mint: usdcMint.address,
    owner: recipient.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const createSwigAtaIx = await getCreateAssociatedTokenInstructionAsync({
    payer: devWallet,
    mint: usdcMint.address,
    owner: swigWalletAddress,
  });

  const createRecipAtaIx = await getCreateAssociatedTokenInstructionAsync({
    payer: devWallet,
    mint: usdcMint.address,
    owner: recipient.address,
  });

  const mintToIx = await getMintToCheckedInstruction({
    mint: usdcMint.address,
    token: swigAta,
    mintAuthority: devWallet,
    amount: 1_000_000n, // 1.000000 with 6 decimals
    decimals: DECIMALS,
  });

  await sendTx(
    [createMintIx, initMintIx, createSwigAtaIx, createRecipAtaIx, mintToIx],
    devWallet,
  );

  // ----- Give devWallet token spend permissions on SWIG -----
  await swig.refetch();

  const devIxs = await getAddAuthorityInstructions(
    swig,
    swig.findRolesByEd25519SignerPk(userMgr.address)[0].id,
    createEd25519AuthorityInfo(devWallet.address),
    Actions.set()
      .tokenLimit({ mint: usdcMint.address, amount: 1_000_000n })
      .get(), // 1.000000 max
    { payer: userMgr.address },
  );
  await sendTx(devIxs, userMgr);
  await swig.refetch();

  const devRole = swig.findRolesByEd25519SignerPk(devWallet.address)[0];

  // ----- Transfer 0.250000 tokens from SWIG to recipient -----
  const transferIx = getTransferCheckedInstruction({
    source: swigAta,
    destination: recipAta,
    mint: usdcMint.address,
    authority: swigWalletAddress,
    amount: 250_000n, // 0.250000
    decimals: DECIMALS,
  });

  // Use a finalized slot for deterministic signing context
  const currentSlot = BigInt(
    await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
  );

  const signIxs = await getSignInstructions(
    swig,
    devRole.id,
    [transferIx],
    false,
    { payer: devWallet.address, currentSlot },
  );

  const sig = await sendTx(signIxs, devWallet);

  console.log(`Tx hash: https://explorer.solana.com/tx/${sig}?cluster=custom`);
})();
