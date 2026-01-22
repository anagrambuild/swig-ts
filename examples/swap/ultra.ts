import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
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
  getSwigWalletAddress,
  Swig,
} from '@swig-wallet/classic';

import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

import chalk from 'chalk';
import * as fs from 'fs';

const JUPITER_ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';

interface UltraOrderResponse {
  mode: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
    bps: number;
    usdValue: number;
  }>;
  feeBps: number;
  transaction: string | null;
  gasless: boolean;
  requestId: string;
  totalTime: number;
  taker: string | null;
  inUsdValue?: number;
  outUsdValue?: number;
  priceImpact?: number;
  errorCode?: number;
  errorMessage?: string;
}

interface UltraExecuteResponse {
  status: 'Success' | 'Failed';
  code: number;
  signature?: string;
  slot?: string;
  error?: string;
  totalInputAmount?: string;
  totalOutputAmount?: string;
  inputAmountResult?: string;
  outputAmountResult?: string;
  swapEvents?: Array<{
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
  }>;
}

function formatNumber(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

async function getUltraOrder(
  inputMint: string,
  outputMint: string,
  amount: string,
  taker: string,
  receiver: string,
  apiKey: string,
): Promise<UltraOrderResponse> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    taker,
    receiver,
  });

  const response = await fetch(`${JUPITER_ULTRA_API_BASE}/order?${params}`, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get ultra order: ${response.statusText}`);
  }

  return response.json();
}

async function executeUltraOrder(
  signedTransaction: string,
  requestId: string,
  apiKey: string,
): Promise<UltraExecuteResponse> {
  const response = await fetch(`${JUPITER_ULTRA_API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      signedTransaction,
      requestId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute ultra order: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Decompile a VersionedTransaction's instructions back to TransactionInstruction[]
 */
function decompileInstructions(
  tx: VersionedTransaction,
  lookupTableAccounts: AddressLookupTableAccount[],
): TransactionInstruction[] {
  const message = tx.message;
  const accountKeys = message.getAccountKeys({
    addressLookupTableAccounts: lookupTableAccounts,
  });

  return message.compiledInstructions.map((compiledIx) => {
    const programId = accountKeys.get(compiledIx.programIdIndex)!;
    const keys = compiledIx.accountKeyIndexes.map((index) => {
      const pubkey = accountKeys.get(index)!;
      return {
        pubkey,
        isSigner: message.isAccountSigner(index),
        isWritable: message.isAccountWritable(index),
      };
    });

    return new TransactionInstruction({
      programId,
      keys,
      data: Buffer.from(compiledIx.data),
    });
  });
}

async function main() {
  // Check for keypair file argument
  if (process.argv.length < 3) {
    console.error(chalk.red('Please provide the path to your keypair file'));
    console.error(
      chalk.yellow('Usage: bun run ultra.ts <path-to-keypair> [swig-address]'),
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

  const jupiterApiKey = process.env.JUPITER_API_KEY;
  if (!jupiterApiKey) {
    console.error(chalk.red('Please set JUPITER_API_KEY in your environment.'));
    process.exit(1);
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  console.log(chalk.cyan(`Connected to Solana RPC: ${rpcUrl}`));
  console.log(
    chalk.green('Root user public key:'),
    chalk.cyan(rootUser.publicKey.toBase58()),
  );

  const balance = await connection.getBalance(rootUser.publicKey);
  if (balance < 0.02 * LAMPORTS_PER_SOL) {
    console.error(chalk.red('Insufficient SOL. Need at least 0.02 SOL.'));
    process.exit(1);
  }
  console.log(
    chalk.blue(
      `Root user balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
    ),
  );

  let swigAccountAddress: PublicKey;
  let swigWalletAddress: PublicKey;
  let swig: Swig;

  if (process.argv[3]) {
    swigAccountAddress = new PublicKey(process.argv[3]);
    console.log(
      chalk.yellow('Using existing Swig account:'),
      chalk.cyan(swigAccountAddress.toBase58()),
    );
    swig = await fetchSwig(connection, swigAccountAddress);

    const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
    if (!rootRole) {
      console.error(
        chalk.red('Root user does not have authority over this Swig account'),
      );
      process.exit(1);
    }
  } else {
    const id = randomBytes(32);
    swigAccountAddress = findSwigPda(id);
    const rootActions = Actions.set().all().get();

    const createIx = await getCreateSwigInstruction({
      payer: rootUser.publicKey,
      actions: rootActions,
      authorityInfo: createEd25519AuthorityInfo(rootUser.publicKey),
      id,
    });

    await sendTransaction(connection, [createIx], rootUser);
    swig = await fetchSwig(connection, swigAccountAddress);
    console.log(
      chalk.green('Swig account created at:'),
      chalk.cyan(swigAccountAddress.toBase58()),
    );
  }

  swigWalletAddress = await getSwigWalletAddress(swig);
  console.log(
    chalk.green('Swig wallet address:'),
    chalk.cyan(swigWalletAddress.toBase58()),
  );

  // Create ephemeral keypair for the swap
  const ephemeralKeypair = Keypair.generate();
  console.log(
    chalk.yellow('Ephemeral keypair created:'),
    chalk.cyan(ephemeralKeypair.publicKey.toBase58()),
  );

  const usdcMint = new PublicKey(
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  );
  const wrappedSolMint = new PublicKey(
    'So11111111111111111111111111111111111111112',
  );

  // Ensure Swig USDC ATA exists (where swap output will go)
  const swigUsdcAta = await getAssociatedTokenAddress(
    usdcMint,
    swigWalletAddress,
    true,
  );
  try {
    await getAccount(connection, swigUsdcAta);
    console.log(
      chalk.green('Swig USDC ATA exists:'),
      chalk.cyan(swigUsdcAta.toBase58()),
    );
  } catch {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      rootUser.publicKey,
      swigUsdcAta,
      swigWalletAddress,
      usdcMint,
    );
    await sendTransaction(connection, [createAtaIx], rootUser);
    console.log(
      chalk.green('Created Swig USDC ATA:'),
      chalk.cyan(swigUsdcAta.toBase58()),
    );
  }

  // The amount of SOL to swap (in lamports)
  const swapAmount = 0.01 * LAMPORTS_PER_SOL;

  // Step 1: Get the Ultra order with ephemeral keypair as taker and swig wallet as receiver
  console.log(chalk.blue('\nRequesting Jupiter Ultra order...'));
  const orderResponse = await getUltraOrder(
    wrappedSolMint.toBase58(),
    usdcMint.toBase58(),
    Math.floor(swapAmount).toString(),
    ephemeralKeypair.publicKey.toBase58(),
    swigWalletAddress.toBase58(),
    jupiterApiKey,
  );

  if (orderResponse.errorCode || !orderResponse.transaction) {
    console.error(
      chalk.red(`Failed to get order: ${orderResponse.errorMessage}`),
    );
    process.exit(1);
  }

  console.log(chalk.blue('Order received:'));
  console.log(
    `   Input: ${formatNumber(Number(orderResponse.inAmount))} lamports`,
  );
  console.log(
    `   Output: ${formatNumber(Number(orderResponse.outAmount))} USDC (raw)`,
  );
  console.log(`   Request ID: ${orderResponse.requestId}`);

  // Step 2: Decode the transaction from Jupiter
  const swapTxBuffer = Buffer.from(orderResponse.transaction, 'base64');
  const swapTx = VersionedTransaction.deserialize(swapTxBuffer);

  // Step 3: Get lookup tables from the Jupiter transaction
  const lookupTableAccounts: AddressLookupTableAccount[] = [];

  if (swapTx.message.addressTableLookups.length > 0) {
    console.log(
      chalk.blue(
        `Fetching ${swapTx.message.addressTableLookups.length} address lookup tables...`,
      ),
    );
    const lookupTablePromises = swapTx.message.addressTableLookups.map(
      async (lookup) => {
        const res = await connection.getAddressLookupTable(lookup.accountKey);
        return res.value;
      },
    );
    const tables = await Promise.all(lookupTablePromises);
    for (const table of tables) {
      if (table !== null) {
        lookupTableAccounts.push(table);
      }
    }
  }

  // Step 4: Decompile Jupiter transaction to get its instructions
  const jupiterInstructions = decompileInstructions(
    swapTx,
    lookupTableAccounts,
  );
  console.log(
    chalk.blue(`Decompiled ${jupiterInstructions.length} Jupiter instructions`),
  );

  // Step 5: Create the funding instruction from Swig to ephemeral keypair
  // This transfers SOL from the Swig wallet to fund the ephemeral keypair for the swap
  const fundingInstruction = SystemProgram.transfer({
    fromPubkey: swigWalletAddress,
    toPubkey: ephemeralKeypair.publicKey,
    lamports: Math.floor(swapAmount) + 10000, // Add extra for fees
  });

  // Get the sign instructions for funding from Swig
  const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
  const fundingSignIxs = await getSignInstructions(swig, rootRole.id, [
    fundingInstruction,
  ]);

  // Step 6: Build the combined transaction
  // Order: Swig funding instructions first, then Jupiter swap instructions
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const combinedInstructions = [...fundingSignIxs, ...jupiterInstructions];

  console.log(
    chalk.blue(
      `Building combined transaction with ${combinedInstructions.length} instructions`,
    ),
  );
  console.log(
    chalk.gray(`   - ${fundingSignIxs.length} Swig funding instructions`),
  );
  console.log(
    chalk.gray(`   - ${jupiterInstructions.length} Jupiter swap instructions`),
  );

  const combinedMessageV0 = new TransactionMessage({
    payerKey: rootUser.publicKey,
    recentBlockhash: blockhash,
    instructions: combinedInstructions,
  }).compileToV0Message(lookupTableAccounts);

  const combinedTx = new VersionedTransaction(combinedMessageV0);

  // Sign with both rootUser (for Swig instructions) and ephemeralKeypair (for Jupiter swap)
  combinedTx.sign([rootUser, ephemeralKeypair]);

  // Serialize the signed transaction
  const signedTransaction = Buffer.from(combinedTx.serialize()).toString(
    'base64',
  );

  // Step 7: Execute via Jupiter Ultra API
  console.log(
    chalk.blue('\nExecuting combined transaction via Jupiter Ultra...'),
  );
  const executeResponse = await executeUltraOrder(
    signedTransaction,
    orderResponse.requestId,
    jupiterApiKey,
  );

  if (executeResponse.status !== 'Success') {
    throw new Error(`Swap execution failed: ${executeResponse.error}`);
  }

  console.log(chalk.green('Swap successful!'));
  console.log(chalk.gray(`   Signature: ${executeResponse.signature}`));
  console.log(
    chalk.blue(
      `   Input amount: ${executeResponse.inputAmountResult || executeResponse.totalInputAmount}`,
    ),
  );
  console.log(
    chalk.blue(
      `   Output amount: ${executeResponse.outputAmountResult || executeResponse.totalOutputAmount}`,
    ),
  );

  // Step 8: Transfer any remaining SOL from ephemeral keypair back to Swig
  // Wait a bit for the state to settle
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const ephemeralBalance = await connection.getBalance(
    ephemeralKeypair.publicKey,
  );
  console.log(
    chalk.blue(
      `\nEphemeral keypair remaining balance: ${ephemeralBalance} lamports`,
    ),
  );

  if (ephemeralBalance > 5000) {
    // Keep some for rent if needed, transfer the rest back
    const transferBackAmount = ephemeralBalance - 5000;
    const transferBackTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: ephemeralKeypair.publicKey,
        toPubkey: swigWalletAddress,
        lamports: transferBackAmount,
      }),
    );
    transferBackTx.feePayer = ephemeralKeypair.publicKey;
    transferBackTx.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transferBackTx.sign(ephemeralKeypair);

    const transferBackSig = await connection.sendRawTransaction(
      transferBackTx.serialize(),
    );
    await connection.confirmTransaction(transferBackSig);
    console.log(
      chalk.green('Transferred remaining SOL back to Swig:'),
      transferBackSig,
    );
  }

  // Check final USDC balance
  const postSwapBalance = await connection.getTokenAccountBalance(swigUsdcAta);
  console.log(
    chalk.blue(`\nFinal Swig USDC balance: ${postSwapBalance.value.uiAmount}`),
  );
}

main().catch((err) => {
  console.error(chalk.red('Fatal Error:'), err);
  process.exit(1);
});
