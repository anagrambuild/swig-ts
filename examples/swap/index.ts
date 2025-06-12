import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, TransactionInstruction, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, SendTransactionError } from '@solana/web3.js';
import {
  Actions,
  createSwig,
  Ed25519Authority,
  findSwigPda,
  signInstruction,
  Swig,
  fetchSwig,
} from '@swig-wallet/classic';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import chalk from 'chalk';
import { createJupiterApiClient } from '@jup-ag/api';
import * as fs from 'fs';

// Helper to format numbers with commas
const formatNumber = (n: number) => {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Helper to convert instruction to TransactionInstruction
const toTransactionInstruction = (instruction: any): TransactionInstruction => {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data, 'base64'),
  });
};

async function createSwigAccount(
  connection: Connection,
  user: Keypair,
) {
  try {
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);
    const [swigAddress] = findSwigPda(id);
    const rootAuthority = Ed25519Authority.fromPublicKey(user.publicKey);
    // Create with all permissions
    const rootActions = Actions.set().all().get();
    const tx = await createSwig(
      connection,
      id,
      rootAuthority,
      rootActions,
      user.publicKey,
      [user]
    );

    console.log(chalk.green("✓ Swig account created at:"), chalk.cyan(swigAddress.toBase58()));
    return swigAddress;
  } catch (error) {
    console.error(chalk.red("✗ Error creating Swig account:"), chalk.red(error));
    throw error;
  }
}

async function main() {
  // Check for keypair file argument
  if (process.argv.length < 3) {
    console.error(chalk.red('Please provide the path to your keypair file'));
    console.error(chalk.yellow('Usage: bun run index.ts <path-to-keypair> [swig-address]'));
    process.exit(1);
  }

  // Load keypair from file
  const keypairPath = process.argv[2];
  if (!fs.existsSync(keypairPath)) {
    console.error(chalk.red(`Keypair file not found at ${keypairPath}`));
    process.exit(1);
  }

  const rootUser = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  console.log(chalk.red('🚨 This example must be run on mainnet'));
  // Initialize connection
  const connection = new Connection(process.env.RPC_URL!, 'confirmed');
  console.log(chalk.cyan('🌐 Connected to Solana mainnet'));
  console.log(chalk.green("👤 Root user public key:"), chalk.cyan(rootUser.publicKey.toBase58()));

  // Check root user balance
  const balance = await connection.getBalance(rootUser.publicKey);
  if (balance < 0.02 * LAMPORTS_PER_SOL) {
    console.error(chalk.red('Root user has insufficient SOL. Need at least 0.02 SOL for fees and transfer.'));
    process.exit(1);
  }
  console.log(chalk.blue(`💰 Root user balance: ${balance / LAMPORTS_PER_SOL} SOL`));

  // Get or create Swig account
  let swigAddress: PublicKey;
  if (process.argv[3]) {
    // Use existing Swig account
    try {
      swigAddress = new PublicKey(process.argv[3]);
      console.log(chalk.yellow("\n📝 Using existing Swig account:"), chalk.cyan(swigAddress.toBase58()));

      // Verify the Swig account exists and root user has authority
      const swig = await fetchSwig(connection, swigAddress);
      const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
      if (!rootRole) {
        throw new Error('Root user does not have authority over this Swig account');
      }
    } catch (error) {
      console.error(chalk.red("Error verifying Swig account:"), error);
      process.exit(1);
    }
  } else {
    // Create new Swig account
    console.log(chalk.yellow("\n📝 Creating new Swig account..."));
    swigAddress = await createSwigAccount(connection, rootUser);
  }

  // Example: Swap SOL to USDC
  const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const wrappedSolMint = new PublicKey('So11111111111111111111111111111111111111112');

  // Check if Swig has USDC ATA
  const swigUsdcAta = await getAssociatedTokenAddress(usdcMint, swigAddress, true);
  let createAtaIx: TransactionInstruction | null = null;

  try {
    await getAccount(connection, swigUsdcAta);
    console.log(chalk.green("✓ USDC token account exists:"), chalk.cyan(swigUsdcAta.toBase58()));
  } catch (error) {
    console.log(chalk.yellow("⚠️  Creating USDC token account for Swig..."));
    createAtaIx = createAssociatedTokenAccountInstruction(
      rootUser.publicKey,
      swigUsdcAta,
      swigAddress,
      usdcMint
    );

    // Create ATA
    const createAtaTx = new Transaction().add(createAtaIx);
    await sendAndConfirmTransaction(connection, createAtaTx, [rootUser]);
    console.log(chalk.green("✓ Created USDC token account:"), chalk.cyan(swigUsdcAta.toBase58()));
  }

  // Check if Swig has Wrapped SOL ATA
  const swigWrappedSolAta = await getAssociatedTokenAddress(wrappedSolMint, swigAddress, true);
  let createWrappedSolAtaIx: TransactionInstruction | null = null;

  try {
    await getAccount(connection, swigWrappedSolAta);
    console.log(chalk.green("✓ Wrapped SOL token account exists:"), chalk.cyan(swigWrappedSolAta.toBase58()));
  } catch (error) {
    console.log(chalk.yellow("⚠️  Creating Wrapped SOL token account for Swig..."));
    createWrappedSolAtaIx = createAssociatedTokenAccountInstruction(
      rootUser.publicKey,
      swigWrappedSolAta,
      swigAddress,
      wrappedSolMint
    );

    // Create ATA
    const createAtaTx = new Transaction().add(createWrappedSolAtaIx);
    await sendAndConfirmTransaction(connection, createAtaTx, [rootUser]);
    console.log(chalk.green("✓ Created Wrapped SOL token account:"), chalk.cyan(swigWrappedSolAta.toBase58()));
  }

  // Transfer 0.01 SOL to the Swig account
  console.log(chalk.yellow("\n💸 Transferring 0.01 SOL to Swig..."));
  const transferAmount = 0.01 * LAMPORTS_PER_SOL;
  const transferTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: rootUser.publicKey,
      toPubkey: swigAddress,
      lamports: transferAmount,
    })
  );
  await sendAndConfirmTransaction(connection, transferTx, [rootUser]);
  console.log(chalk.green("✓ Transferred 0.01 SOL to Swig"));

  // Initialize Jupiter API client
  const jupiterQuoteApi = createJupiterApiClient();
  console.log(chalk.magenta('🚀 Jupiter API initialized'));

  // Example: Swap SOL to USDC

  // Get quote
  const quoteResponse = await jupiterQuoteApi.quoteGet({
    inputMint: "So11111111111111111111111111111111111111112", // SOL
    outputMint: usdcMint.toBase58(), // USDC
    amount: Math.floor(transferAmount), // 0.01 SOL in lamports
    slippageBps: 50, // 0.5%
    maxAccounts: 64,
  });

  if (!quoteResponse) {
    console.log(chalk.red('❌ No quote available'));
    return;
  }

  // Get best route
  console.log(chalk.blue('📊 Quote found:'));
  console.log(chalk.gray(`   Input: ${formatNumber(Number(quoteResponse.inAmount))} lamports`));
  console.log(chalk.gray(`   Output: ${formatNumber(Number(quoteResponse.outAmount))} USDC (in smallest units)`));

  // Execute swap
  try {
    // Get swap instructions
    const swapInstructions = await jupiterQuoteApi.swapInstructionsPost({
      swapRequest: {
        quoteResponse,
        userPublicKey: swigAddress.toBase58(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
      }
    });

    if (!swapInstructions) {
      throw new Error('No swap instructions received');
    }

    // Get the Swig account
    const swig = await fetchSwig(connection, swigAddress);
    const rootRole = swig.findRolesByEd25519SignerPk(rootUser.publicKey)[0];
    if (!rootRole) {
      throw new Error('Root role not found');
    }
    const outerInstructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 150_000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 50,
      }),
    ];

    // Convert instructions to TransactionInstructions
    const swigInstructions: TransactionInstruction[] = [
      ...(swapInstructions.setupInstructions || []).map(toTransactionInstruction),
      toTransactionInstruction(swapInstructions.swapInstruction),
    ];

    // Get address lookup tables
    const addressLookupTableAccounts = await Promise.all(
      swapInstructions.addressLookupTableAddresses.map(async (address) => {
        const account = await connection.getAddressLookupTable(new PublicKey(address))
          .then((res) => res.value);
        if (!account) {
          throw new Error(`Could not find address lookup table: ${address}`);
        }
        return account;
      })
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const signIxs = await Promise.all(
      swigInstructions.map(async (instruction) => {
        return await signInstruction(
          rootRole,
          rootUser.publicKey,
          [instruction]
        );
      })
    );

    // Create versioned transaction
    const messageV0 = new TransactionMessage({
      payerKey: rootUser.publicKey,
      recentBlockhash: blockhash,
      instructions: [...outerInstructions, ...signIxs],
    }).compileToV0Message(addressLookupTableAccounts);

    const transaction = new VersionedTransaction(messageV0);
    // Sign the instructions with root user
    try {
      transaction.sign([rootUser]);
    } catch (error) {
      console.error(chalk.red('Error signing transaction:'), error);
      process.exit(1);
    }
    console.log(chalk.green('✅ Swap transaction signed'));

    try {
      // Send the transaction
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: true,
        preflightCommitment: 'confirmed'
      });
      const tx = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });
      if (tx.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(tx.value.err)}`);
      }

      // Check token balance after swap
      const postSwapBalance = await connection.getTokenAccountBalance(swigUsdcAta);
      console.log(chalk.green('🎉 Swap transaction sent and confirmed!'));
      console.log(chalk.gray(`   Transaction signature: ${signature}`));
      console.log(chalk.blue(`💰 New USDC balance: ${postSwapBalance.value.uiAmount} USDC`));
    } catch (error) {

      console.error(chalk.red('Error sending transaction:'), error);
      process.exit(1);
    }


  } catch (error) {
    console.error(chalk.red('Error executing swap:'), error);
  }
}

main().catch((error) => {
  console.error(chalk.red('Error in main:'), error);
  process.exit(1);
});
