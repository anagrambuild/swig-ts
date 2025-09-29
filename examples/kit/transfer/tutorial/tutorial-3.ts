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
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';

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

import {
  TOKEN_2022_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getTransferCheckedInstruction,
} from '@solana-program/token-2022';

import { getCreateAccountInstruction } from '@solana-program/system';
import chalk from 'chalk';

// ---------------- utils ----------------
const LAMPORTS_PER_SOL = 1_000_000_000n;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint,
) {
  const sig = await (rpc as any)
    .requestAirdrop?.(to, lamports(amount))
    ?.send?.();
  if (!sig) {
    throw new Error('requestAirdrop is not supported by this RPC client');
  }
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1200);
}

async function sendTransaction(
  connection: {
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  instructions: IInstruction[],
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
): Promise<string> {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();
  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );
  const signedTx = await signTransactionMessageWithSigners(txMsg);
  await sendAndConfirmTransactionFactory(connection as any)(signedTx, {
    commitment: 'confirmed',
  });
  return getSignatureFromTransaction(signedTx).toString();
}

function randomBytes(len: number) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

// ---------------- setup ----------------
const rpc = createSolanaRpc('http://localhost:8899');
const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');
const connection = { rpc, rpcSubscriptions };

// ---------------- main ----------------
(async () => {
  console.log(chalk.blue('🚀 Token-2022 Authority & Transfers (Kit style)'));

  // Root user & funding
  const rootUser = await generateKeyPairSigner();
  console.log(
    chalk.green('👤 Root user:'),
    chalk.cyan(rootUser.address.toString()),
  );
  await confirmAirdrop(rpc, rootUser.address, 100n * LAMPORTS_PER_SOL);

  // Create SWIG with manageAuthority-only (switch to .all() if desired)
  const id = randomBytes(32);
  const swigAddress = await findSwigPda(id);
  const rootActions = Actions.set().manageAuthority().get();
  const createSwigIx = await getCreateSwigInstruction({
    payer: rootUser.address,
    id,
    actions: rootActions,
    authorityInfo: createEd25519AuthorityInfo(rootUser.address),
  });
  await sendTransaction(connection, [createSwigIx], rootUser);
  console.log(
    chalk.green('✓ Swig created:'),
    chalk.cyan(swigAddress.toString()),
  );

  // Fetch swig and show wallet address
  const swigForWallet = await fetchSwig(rpc, swigAddress);
  const swigWalletAddress = await getSwigWalletAddress(swigForWallet);
  console.log(
    chalk.green('📦 Swig wallet address:'),
    chalk.cyan(swigWalletAddress.toString()),
  );

  // Give the SWIG PDA a bit of SOL for rent/fees (optional)
  await confirmAirdrop(rpc, swigAddress, 1n * LAMPORTS_PER_SOL);
  console.log(chalk.green('✓ Airdropped 1 SOL to SWIG'));

  // ----- Create a Token-2022 mint & fund SWIG ATA -----
  const mint = await generateKeyPairSigner();
  const mintAuthority = rootUser;
  const decimals = 0;

  const mintSize = BigInt(getMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(mintSize).send();

  const createMintAccountIx = getCreateAccountInstruction({
    payer: mintAuthority,
    newAccount: mint,
    lamports: rent,
    space: mintSize,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const initMintIx = getInitializeMintInstruction({
    mint: mint.address,
    decimals,
    mintAuthority: mintAuthority.address,
  });

  const [swigATA] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: swigWalletAddress,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const createSwigATAIx = await getCreateAssociatedTokenInstructionAsync({
    payer: mintAuthority,
    mint: mint.address,
    owner: swigWalletAddress,
  });

  const mintToSwigIx = await getMintToCheckedInstruction({
    mint: mint.address,
    token: swigATA,
    mintAuthority,
    amount: 10n,
    decimals,
  });

  await sendTransaction(
    connection,
    [createMintAccountIx, initMintIx, createSwigATAIx, mintToSwigIx],
    mintAuthority,
    [mint],
  );
  console.log(chalk.green('✓ Minted 10 tokens to SWIG ATA'));

  // ----- Recipient setup -----
  const recipient = await generateKeyPairSigner();
  const [recipientATA] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: recipient.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  const createRecipientATAIx = await getCreateAssociatedTokenInstructionAsync({
    payer: rootUser,
    mint: mint.address,
    owner: recipient.address,
  });
  await sendTransaction(connection, [createRecipientATAIx], rootUser);
  console.log(chalk.green('✓ Recipient ATA created'));

  // ----- Add token-limited authority (can spend up to 10) -----
  const tokenAuthority = await generateKeyPairSigner();
  await confirmAirdrop(rpc, tokenAuthority.address, 1n * LAMPORTS_PER_SOL);

  const tokenActions = Actions.set()
    .tokenLimit({ mint: mint.address, amount: 10n })
    .get();

  const swig = await fetchSwig(rpc, swigAddress);
  const rootRole = swig.findRolesByEd25519SignerPk(rootUser.address)[0];

  const addAuthorityIxs = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(tokenAuthority.address),
    tokenActions,
    { payer: rootUser.address },
  );
  await sendTransaction(connection, addAuthorityIxs, rootUser);
  console.log(chalk.green('✓ Token authority added'));

  // Balances
  const swigBalance = await rpc.getBalance(swigWalletAddress).send();
  console.log(
    chalk.green('✓ SWIG SOL balance:'),
    chalk.cyan(swigBalance.value.toString()),
  );
  const swigATABal = await rpc.getTokenAccountBalance(swigATA).send();
  console.log(
    chalk.green('✓ SWIG ATA balance:'),
    chalk.cyan(swigATABal.value.amount),
  );
  const recipATABal = await rpc.getTokenAccountBalance(recipientATA).send();
  console.log(
    chalk.green('✓ Recipient ATA balance:'),
    chalk.cyan(recipATABal.value.amount),
  );

  // ----- First transfer (should succeed): 10 tokens -----
  {
    const swigLatest = await fetchSwig(rpc, swigAddress);
    const role = swigLatest.findRolesByEd25519SignerPk(
      tokenAuthority.address,
    )[0];

    const transfer = getTransferCheckedInstruction({
      source: swigATA,
      destination: recipientATA,
      mint: mint.address,
      amount: 10n,
      decimals,
      authority: swigWalletAddress,
    });

    // Use a finalized slot for deterministic signing context
    const currentSlot = BigInt(
      await rpc.getSlot({ commitment: 'finalized' }).send(),
    );
    const signed = await getSignInstructions(
      swigLatest,
      role.id,
      [transfer],
      false,
      {
        payer: tokenAuthority.address,
        currentSlot,
      },
    );
    const sig = await sendTransaction(connection, signed, tokenAuthority);
    console.log(chalk.green('✓ First transfer succeeded:'), chalk.cyan(sig));
  }

  // Balances after first transfer
  {
    const swigATABal2 = await rpc.getTokenAccountBalance(swigATA).send();
    const recipATABal2 = await rpc.getTokenAccountBalance(recipientATA).send();
    console.log(
      chalk.green('✓ SWIG ATA balance after transfer:'),
      chalk.cyan(swigATABal2.value.amount),
    );
    console.log(
      chalk.green('✓ Recipient ATA balance after transfer:'),
      chalk.cyan(recipATABal2.value.amount),
    );
  }

  // ----- Second transfer (should fail; allowance spent) -----
  try {
    const swigLatest = await fetchSwig(rpc, swigAddress);
    const role = swigLatest.findRolesByEd25519SignerPk(
      tokenAuthority.address,
    )[0];

    const transferAgain = getTransferCheckedInstruction({
      source: swigATA,
      destination: recipientATA,
      mint: mint.address,
      amount: 1n, // exceed remaining allowance (should be 0)
      decimals,
      authority: swigWalletAddress,
    });

    const currentSlot = BigInt(
      await rpc.getSlot({ commitment: 'finalized' }).send(),
    );
    const signed = await getSignInstructions(
      swigLatest,
      role.id,
      [transferAgain],
      false,
      {
        payer: tokenAuthority.address,
        currentSlot,
      },
    );
    await sendTransaction(connection, signed, tokenAuthority);
    console.error(chalk.red('✗ Second transfer unexpectedly succeeded!'));
  } catch {
    console.log(
      chalk.green('✓ Second transfer failed as expected (no allowance left)'),
    );
  }

  console.log(chalk.green('\n✨ Tutorial completed successfully!'));
  console.log(
    chalk.yellow('🔍 View your SWIG on Explorer:'),
    chalk.cyan(
      `https://explorer.solana.com/address/${swigAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    ),
  );
})();
