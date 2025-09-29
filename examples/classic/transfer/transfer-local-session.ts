import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type Signer,
} from '@solana/web3.js';

import {
  Actions,
  createEd25519SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

import { randomBytes as nodeRandomBytes } from 'node:crypto';

// ---------- Helpers ----------

async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Signer[] = [],
) {
  const tx = new Transaction().add(...instructions);

  try {
    const sig = await sendAndConfirmTransaction(
      connection,
      tx,
      [payer, ...signers],
      {
        commitment: 'confirmed',
      },
    );
    console.log(
      `🔗 Sent tx: https://explorer.solana.com/tx/${sig}?cluster=custom`,
    );
    return sig;
  } catch (err: any) {
    // Show detailed logs if available
    if (err instanceof SendTransactionError) {
      try {
        const logs = await err.getLogs(connection);
        console.error(
          '❌ SendTransactionError logs:\n',
          logs?.join('\n') ?? '(no logs)',
        );
      } catch {
        console.error(
          '❌ SendTransactionError thrown (no logs available via getLogs)',
        );
      }
    }
    console.error('❌ sendTransaction error:', err);
    throw err;
  }
}

function randomBytes(length: number): Uint8Array {
  // Node-friendly random bytes (no Web Crypto assumptions)
  return new Uint8Array(nodeRandomBytes(length));
}

function sleep(s: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, s * 1000));
}

// ---------- Main ----------

async function main() {
  console.log('🚀 starting...');

  // Local validator
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root authority (session-based)
  const userRootKeypair = Keypair.generate();
  await connection.requestAirdrop(userRootKeypair.publicKey, LAMPORTS_PER_SOL);

  // Dapp session authority (will spend within limit)
  const dappSessionKeypair = Keypair.generate();
  await connection.requestAirdrop(
    dappSessionKeypair.publicKey,
    LAMPORTS_PER_SOL,
  );

  // Treasury (recipient)
  const dappTreasury = Keypair.generate().publicKey;

  await sleep(2);

  // Deterministic Swig PDA
  const id = randomBytes(32);
  const swigAddress = findSwigPda(id);

  // 1) Create Swig with a root *session* authority (with its own limit)
  const rootActions = Actions.set().all().get();
  const createSwigIx = await getCreateSwigInstruction({
    id,
    authorityInfo: createEd25519SessionAuthorityInfo(
      userRootKeypair.publicKey,
      100n,
    ), // root session limit (lamports)
    actions: rootActions,
    payer: userRootKeypair.publicKey,
  });

  await sendTransaction(connection, [createSwigIx], userRootKeypair);
  await sleep(2);

  // Fetch Swig account
  const swig = await fetchSwig(connection, swigAddress);

  const rootRole = swig.findRoleById(0);
  if (!rootRole) throw new Error('Root role not found');

  // 2) Create a session for the dapp (spend limit = 50 lamports in this demo)
  const createSessionIxs = await getCreateSessionInstructions(
    swig,
    rootRole.id,
    dappSessionKeypair.publicKey,
    50n, // session spend limit (lamports)
    { payer: userRootKeypair.publicKey },
  );

  await sendTransaction(connection, createSessionIxs, userRootKeypair);
  await sleep(2);

  // 3) FUND THE SWIG WALLET PDA (not the swig account PDA!)
  const swigWalletAddress = await getSwigWalletAddress(swig);
  await connection.requestAirdrop(swigWalletAddress, LAMPORTS_PER_SOL);
  await sleep(2);

  await swig.refetch();

  console.log('👛 swig wallet address:', swigWalletAddress.toBase58());

  console.log(
    '🔎 Roles spend SOL capability:',
    swig.roles.map((r) => ({
      id: r.id.toString(),
      canSpend01: r.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
    })),
  );

  console.log(
    '💰 Swig wallet balance (before):',
    await connection.getBalance(swigWalletAddress),
  );
  console.log(
    '💰 Treasury balance (before):',
    await connection.getBalance(dappTreasury),
  );

  // 4) Spend from the session (0.1 SOL)
  const transferIx = SystemProgram.transfer({
    fromPubkey: swigWalletAddress, // ✅ must be the Swig WALLET PDA
    toPubkey: dappTreasury,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });

  const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey);
  if (!sessionRole || !sessionRole.isSessionBased()) {
    throw new Error('Session role not found or not session based');
  }

  // Wrap the transfer for Swig to co-sign
  const signIxs = await getSignInstructions(
    swig,
    sessionRole.id,
    [transferIx],
    false,
    { payer: dappSessionKeypair.publicKey }, // fee payer for the sign call
  );

  await sendTransaction(connection, signIxs, dappSessionKeypair);
  await sleep(2);

  console.log(
    '💰 Swig wallet balance (after):',
    await connection.getBalance(swigWalletAddress),
  );
  console.log(
    '💰 Treasury balance (after):',
    await connection.getBalance(dappTreasury),
  );

  console.log('✅ done');
}

main().catch((err) => {
  console.error('❌ Error running script:', err);
});
