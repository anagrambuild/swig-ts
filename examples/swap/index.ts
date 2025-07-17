import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSignInstructions,
  Swig,
} from '@swig-wallet/classic';

import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

import { createJupiterApiClient } from '@jup-ag/api';
import chalk from 'chalk';
import * as fs from 'fs';

function formatNumber(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function toTransactionInstruction(instruction: any): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((k: any) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(instruction.data, 'base64'),
  });
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
): Promise<string> {
  const tx = new Transaction().add(...instructions);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig);
  return sig;
}

async function main() {
  // Check for keypair file argument
  if (process.argv.length < 3) {
    console.error(chalk.red('Please provide the path to your keypair file'));
    console.error(
      chalk.yellow('Usage: bun run index.ts <path-to-keypair> [swig-address]'),
    );
    process.exit(1);
  }

  const keypairPath = process.argv[2];
  if (!fs.existsSync(keypairPath)) {
    console.error(chalk.red(`Keypair file not found at ${keypairPath}`));
    process.exit(1);
  }

  const rootUser = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))),
  );

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.error(chalk.red('Please set RPC_URL in your environment.'));
    process.exit(1);
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  console.log(chalk.cyan(`🌐 Connected to Solana RPC: ${rpcUrl}`));
  console.log(
    chalk.green('👤 Root user public key:'),
    chalk.cyan(rootUser.publicKey.toBase58()),
  );

  const balance = await connection.getBalance(rootUser.publicKey);
  if (balance < 0.02 * LAMPORTS_PER_SOL) {
    console.error(chalk.red('❌ Insufficient SOL. Need at least 0.02 SOL.'));
    process.exit(1);
  }
  console.log(
    chalk.blue(
      `💰 Root user balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
    ),
  );

  let swigAddress: PublicKey;
  let swig: Swig;

  if (process.argv[3]) {
    swigAddress = new PublicKey(process.argv[3]);
    console.log(
      chalk.yellow('📝 Using existing Swig account:'),
      chalk.cyan(swigAddress.toBase58()),
    );
    swig = await fetchSwig(connection, swigAddress);

    const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
    if (!rootRole) {
      console.error(
        chalk.red(
          '❌ Root user does not have authority over this Swig account',
        ),
      );
      process.exit(1);
    }
  } else {
    const id = randomBytes(32);
    swigAddress = findSwigPda(id);
    const rootActions = Actions.set().all().get();

    const createIx = await getCreateSwigInstruction({
      payer: rootUser.publicKey,
      actions: rootActions,
      authorityInfo: createEd25519AuthorityInfo(rootUser.publicKey),
      id,
    });

    await sendTransaction(connection, [createIx], rootUser);
    swig = await fetchSwig(connection, swigAddress);
    console.log(
      chalk.green('✓ Swig account created at:'),
      chalk.cyan(swigAddress.toBase58()),
    );
  }

  const usdcMint = new PublicKey(
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  );
  const wrappedSolMint = new PublicKey(
    'So11111111111111111111111111111111111111112',
  );

  const swigUsdcAta = await getAssociatedTokenAddress(
    usdcMint,
    swigAddress,
    true,
  );
  try {
    await getAccount(connection, swigUsdcAta);
    console.log(
      chalk.green('✓ USDC ATA exists:'),
      chalk.cyan(swigUsdcAta.toBase58()),
    );
  } catch {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      rootUser.publicKey,
      swigUsdcAta,
      swigAddress,
      usdcMint,
    );
    await sendTransaction(connection, [createAtaIx], rootUser);
    console.log(
      chalk.green('✓ Created USDC ATA:'),
      chalk.cyan(swigUsdcAta.toBase58()),
    );
  }

  const swigWrappedSolAta = await getAssociatedTokenAddress(
    wrappedSolMint,
    swigAddress,
    true,
  );
  try {
    await getAccount(connection, swigWrappedSolAta);
    console.log(
      chalk.green('✓ Wrapped SOL ATA exists:'),
      chalk.cyan(swigWrappedSolAta.toBase58()),
    );
  } catch {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      rootUser.publicKey,
      swigWrappedSolAta,
      swigAddress,
      wrappedSolMint,
    );
    await sendTransaction(connection, [createAtaIx], rootUser);
    console.log(
      chalk.green('✓ Created Wrapped SOL ATA:'),
      chalk.cyan(swigWrappedSolAta.toBase58()),
    );
  }

  const transferAmount = 0.01 * LAMPORTS_PER_SOL;
  const transferTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: rootUser.publicKey,
      toPubkey: swigAddress,
      lamports: transferAmount,
    }),
  );
  await sendAndConfirmTransaction(connection, transferTx, [rootUser]);
  console.log(chalk.green('✓ Transferred 0.01 SOL to Swig'));

  const jupiter = createJupiterApiClient();
  const quote = await jupiter.quoteGet({
    inputMint: wrappedSolMint.toBase58(),
    outputMint: usdcMint.toBase58(),
    amount: Math.floor(transferAmount),
    slippageBps: 50,
    maxAccounts: 64,
  });

  if (!quote) {
    console.log(chalk.red('❌ No quote available'));
    return;
  }

  console.log(chalk.blue('📊 Quote received:'));
  console.log(`   Input: ${formatNumber(Number(quote.inAmount))} lamports`);
  console.log(`   Output: ${formatNumber(Number(quote.outAmount))} USDC (raw)`);

  const swapInstructionsRes = await jupiter.swapInstructionsPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: swigAddress.toBase58(),
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
    },
  });

  const swapInstructions: TransactionInstruction[] = [
    ...(swapInstructionsRes.setupInstructions || []).map(
      toTransactionInstruction,
    ),
    toTransactionInstruction(swapInstructionsRes.swapInstruction),
  ];

  const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
  const signIxs = await getSignInstructions(
    swig,
    rootRole.id,
    swapInstructions,
  );

  const lookupTables = await Promise.all(
    swapInstructionsRes.addressLookupTableAddresses.map(async (addr) => {
      const res = await connection.getAddressLookupTable(new PublicKey(addr));
      return res.value!;
    }),
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const outerIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50 }),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: rootUser.publicKey,
    recentBlockhash: blockhash,
    instructions: [...outerIxs, ...signIxs],
  }).compileToV0Message(lookupTables);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([rootUser]);

  const signature = await connection.sendTransaction(tx, {
    skipPreflight: true,
    preflightCommitment: 'confirmed',
  });

  const result = await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  if (result.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }

  const postSwapBalance = await connection.getTokenAccountBalance(swigUsdcAta);
  console.log(chalk.green('🎉 Swap successful!'));
  console.log(chalk.gray(`   Signature: ${signature}`));
  console.log(
    chalk.blue(`💰 New USDC balance: ${postSwapBalance.value.uiAmount}`),
  );
}

main().catch((err) => {
  console.error(chalk.red('Fatal Error:'), err);
  process.exit(1);
});
