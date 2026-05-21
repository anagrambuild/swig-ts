import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

import { p256 } from '@noble/curves/p256';
import {
  createAssociatedTokenAccountInstruction,
  createMint,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  SwigClient,
  type PreparedTransaction,
} from '@swig-wallet/developer-sdk';
import {
  signPreparedSwigTransaction,
  type PasskeySigningFn,
} from '../src/client/index.js';
import {
  createSwigNestHandler,
  type SwigNestHandler,
  type SwigNestResponseLike,
} from '../src/server/nest/index.js';

const apiBaseUrl = 'http://localhost:8080';
const databaseUrl = 'postgres://swig:swig@localhost:55432/swig';
const rpcUrl = 'http://localhost:8899';
const swapAmountLamports = 10_000_000;
const swapSlippageBps = 1_000;
const tokenTransferAmount = 25;
const localRecoveryPolicyId = 'clocalrecoverypolicy001';
const recoverySmokeOnly = process.env.RECOVERY_SMOKE_ONLY === '1';
const runRecoverySmokeEnabled =
  recoverySmokeOnly || process.env.RUN_RECOVERY_SMOKE === '1';
const runId = randomUUID();
const apiKey = `sk_local_transaction_smoke_${runId}`;
const recoveryApiKey = `sk_local_recovery_smoke_${runId}`;
const userId = `local-smoke-user-${runId}`;
const organizationId = `local-smoke-org-${runId}`;
const apiKeyId = `local-smoke-api-key-${runId}`;
const recoveryApiKeyId = `local-recovery-api-key-${runId}`;
const feePayer = Keypair.generate();
const requester = Keypair.generate();
const destination = Keypair.generate();
const solMint = 'So11111111111111111111111111111111111111112';
const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

await main();

async function main() {
  const connection = new Connection(rpcUrl, 'confirmed');

  seedLocalFixture();

  if (recoverySmokeOnly) {
    console.log(`local recovery smoke: ${runId}`);
    console.log(`api: ${apiBaseUrl}`);
    console.log(`rpc: ${rpcUrl}`);
    await runRecoverySmoke(connection);
    return;
  }

  await airdropIfNeeded(connection, feePayer.publicKey, LAMPORTS_PER_SOL);

  const swig = new SwigClient({
    apiKey,
    baseUrl: apiBaseUrl,
    network: 'devnet',
  });

  console.log(`local transaction smoke: ${runId}`);
  console.log(`api: ${apiBaseUrl}`);
  console.log(`rpc: ${rpcUrl}`);
  console.log(`fee payer: ${feePayer.publicKey.toBase58()}`);
  console.log(`requester: ${requester.publicKey.toBase58()}`);

  const created = await swig.wallets.create({
    feePayer: feePayer.publicKey.toBase58(),
    initialUser: {
      ed25519: {
        publicKey: requester.publicKey.toBase58(),
      },
    },
  });
  const wallet = swig.wallets.use(created.wallet, {
    requesterAuthority: {
      ed25519: { publicKey: requester.publicKey.toBase58() },
    },
  });
  const createTransaction = requirePrepared(created.creationTransaction);
  console.log(`swig config: ${created.wallet.swigConfigAddress}`);
  console.log(`wallet: ${requireWalletAddress(created.wallet.walletAddress)}`);
  const walletAddress = new PublicKey(
    requireWalletAddress(created.wallet.walletAddress),
  );

  const createSignature = await signAndSendPreparedTransaction(
    connection,
    createTransaction,
    [feePayer],
  );
  console.log(`create signature: ${createSignature}`);
  await waitForAccount(
    connection,
    new PublicKey(created.wallet.swigConfigAddress),
  );
  await airdropIfNeeded(connection, walletAddress, LAMPORTS_PER_SOL / 10);
  await airdropIfNeeded(
    connection,
    destination.publicKey,
    await connection.getMinimumBalanceForRentExemption(0),
  );

  const transferTransaction = await wallet.transfer.sol({
    feePayer: feePayer.publicKey.toBase58(),
    requesterAuthority: {
      ed25519: { publicKey: requester.publicKey.toBase58() },
    },
    destination: destination.publicKey.toBase58(),
    amount: 1_000,
  });

  const before = await connection.getBalance(destination.publicKey);
  const transferSignature = await signAndSendPreparedTransaction(
    connection,
    transferTransaction,
    [feePayer, requester],
  );
  const after = await connection.getBalance(destination.publicKey);
  console.log(`transfer signature: ${transferSignature}`);
  console.log(`destination balance delta: ${after - before} lamports`);

  const tokenMint = await createMint(
    connection,
    feePayer,
    feePayer.publicKey,
    null,
    0,
  );
  const walletTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    walletAddress,
    true,
    TOKEN_PROGRAM_ID,
  );
  const destinationTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    destination.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  const tokenSetupTransaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      walletTokenAccount,
      walletAddress,
      tokenMint,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      destinationTokenAccount,
      destination.publicKey,
      tokenMint,
      TOKEN_PROGRAM_ID,
    ),
    createMintToInstruction(
      tokenMint,
      walletTokenAccount,
      feePayer.publicKey,
      tokenTransferAmount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  const tokenSetupSignature = await signAndSendLocalTransaction(
    connection,
    tokenSetupTransaction,
    [feePayer],
  );
  console.log(`token setup signature: ${tokenSetupSignature}`);

  const tokenTransferTransaction = await wallet.transfer.token({
    feePayer: feePayer.publicKey.toBase58(),
    requesterAuthority: {
      ed25519: { publicKey: requester.publicKey.toBase58() },
    },
    mint: tokenMint.toBase58(),
    destinationOwner: destination.publicKey.toBase58(),
    amount: tokenTransferAmount,
  });
  const tokenBefore = await getAccount(connection, destinationTokenAccount);
  const tokenTransferSignature = await signAndSendPreparedTransaction(
    connection,
    tokenTransferTransaction,
    [feePayer, requester],
  );
  const tokenAfter = await getAccount(connection, destinationTokenAccount);
  console.log(`token transfer signature: ${tokenTransferSignature}`);
  console.log(
    `destination token balance delta: ${
      tokenAfter.amount - tokenBefore.amount
    } units`,
  );

  const swapTransaction = await wallet.swap.jupiter({
    feePayer: feePayer.publicKey.toBase58(),
    requesterAuthority: {
      ed25519: { publicKey: requester.publicKey.toBase58() },
    },
    inputMint: solMint,
    outputMint: usdcMint,
    amount: swapAmountLamports,
    slippageBps: swapSlippageBps,
    wrapAndUnwrapSol: true,
    maxAccounts: 20,
    mode: 'fast',
  });
  console.log(
    `swap transaction bytes: ${Buffer.from(swapTransaction.transaction, 'base64').length}`,
  );

  const swapSignature = await signAndSendPreparedTransaction(
    connection,
    swapTransaction,
    [feePayer, requester],
  );
  console.log(`swap signature: ${swapSignature}`);

  const nestHandler = createSwigNestHandler({
    apiKey,
    transactionApiUrl: apiBaseUrl,
    feePayer: feePayer.publicKey.toBase58(),
    resolveRequesterAuthority: () => ({
      ed25519: { publicKey: requester.publicKey.toBase58() },
    }),
  });
  const nestTransferDestination = Keypair.generate();
  await airdropIfNeeded(
    connection,
    nestTransferDestination.publicKey,
    await connection.getMinimumBalanceForRentExemption(0),
  );
  const nestTransferTransaction = await prepareWithNest(nestHandler, {
    route: '/swig/transfer/sol',
    body: {
      wallet: {
        swigConfigAddress: wallet.swigConfigAddress,
        walletAddress: wallet.walletAddress,
      },
      network: 'devnet',
      destination: nestTransferDestination.publicKey.toBase58(),
      amount: '1000',
    },
  });
  const nestTransferSignature = await signAndSendPreparedTransaction(
    connection,
    nestTransferTransaction,
    [feePayer, requester],
  );
  console.log(`nest transfer signature: ${nestTransferSignature}`);

  const nestSwapTransaction = await prepareWithNest(nestHandler, {
    route: '/swig/swap/jupiter',
    body: {
      wallet: {
        swigConfigAddress: wallet.swigConfigAddress,
        walletAddress: wallet.walletAddress,
      },
      network: 'devnet',
      inputMint: solMint,
      outputMint: usdcMint,
      amount: String(swapAmountLamports),
      slippageBps: swapSlippageBps,
      wrapAndUnwrapSol: true,
      maxAccounts: 20,
      mode: 'fast',
    },
  });
  const nestSwapSignature = await signAndSendPreparedTransaction(
    connection,
    nestSwapTransaction,
    [feePayer, requester],
  );
  console.log(`nest swap signature: ${nestSwapSignature}`);

  if (runRecoverySmokeEnabled) {
    await runRecoverySmoke(connection);
  }
}

function seedLocalFixture() {
  const sql = `
BEGIN;

INSERT INTO "user" (id, email, "updatedAt")
VALUES (${sqlLiteral(userId)}, ${sqlLiteral(`${userId}@local.test`)}, NOW())
ON CONFLICT (id) DO UPDATE SET "updatedAt" = NOW();

INSERT INTO "organizations" (id, name, "ownerId", "updatedAt")
VALUES (${sqlLiteral(organizationId)}, ${sqlLiteral(`Local Smoke ${runId}`)}, ${sqlLiteral(userId)}, NOW())
ON CONFLICT (id) DO UPDATE SET "updatedAt" = NOW();

INSERT INTO "api_keys" (id, key, name, "organizationId", "userId", "updatedAt")
VALUES (
  ${sqlLiteral(apiKeyId)},
  ${sqlLiteral(sha256Hex(apiKey))},
  'Local Transaction Smoke',
  ${sqlLiteral(organizationId)},
  ${sqlLiteral(userId)},
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  "updatedAt" = NOW(),
  "organizationId" = EXCLUDED."organizationId",
  "userId" = EXCLUDED."userId";

INSERT INTO "api_keys" (id, key, name, "organizationId", "userId", "updatedAt")
VALUES (
  ${sqlLiteral(recoveryApiKeyId)},
  ${sqlLiteral(sha256Hex(recoveryApiKey))},
  'Local Recovery Smoke',
  'clocaldashboarddemoorg001',
  'clocaldashboarduser001',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  "updatedAt" = NOW(),
  "organizationId" = EXCLUDED."organizationId",
  "userId" = EXCLUDED."userId";

COMMIT;
`;

  try {
    execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1'], {
      input: sql,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
  } catch (error) {
    throw new Error(
      `Failed to seed local transaction API fixture. Make sure psql is installed and Postgres is reachable at ${databaseUrl}.\n${String(error)}`,
    );
  }
}

async function runRecoverySmoke(connection: Connection) {
  const recoveryFeePayer = Keypair.generate();
  const guardian = Keypair.generate();
  const initialAuthority = createP256Authority();
  const newAuthority = createP256Authority();
  const recoveryDestination = Keypair.generate();

  await airdropIfNeeded(
    connection,
    recoveryFeePayer.publicKey,
    LAMPORTS_PER_SOL,
  );
  await airdropIfNeeded(
    connection,
    recoveryDestination.publicKey,
    await connection.getMinimumBalanceForRentExemption(0),
  );

  const recoverySwig = new SwigClient({
    apiKey: recoveryApiKey,
    baseUrl: apiBaseUrl,
    network: 'devnet',
  });

  const created = await recoverySwig.wallets.create({
    feePayer: recoveryFeePayer.publicKey.toBase58(),
    policyId: localRecoveryPolicyId,
    initialUser: {
      secp256r1: {
        publicKey: initialAuthority.publicKeyHex,
      },
    },
    guardianPubkey: guardian.publicKey.toBase58(),
  });
  const recoveryWalletAddress = new PublicKey(
    requireWalletAddress(created.wallet.walletAddress),
  );
  const wallet = recoverySwig.wallets.use(created.wallet, {
    requesterAuthority: {
      secp256r1: {
        publicKey: initialAuthority.publicKeyHex,
      },
    },
  });

  console.log(`recovery swig config: ${created.wallet.swigConfigAddress}`);
  console.log(`recovery wallet: ${recoveryWalletAddress.toBase58()}`);
  console.log(`recovery guardian: ${guardian.publicKey.toBase58()}`);

  const recoveryCreateSignature = await signAndSendPreparedTransaction(
    connection,
    requirePrepared(created.creationTransaction),
    [recoveryFeePayer],
  );
  console.log(`recovery create signature: ${recoveryCreateSignature}`);
  await waitForAccount(
    connection,
    new PublicKey(created.wallet.swigConfigAddress),
  );

  const addRecoverySignature = await signSwigAndSendPreparedTransaction(
    connection,
    requirePrepared(created.addAuthorityTransaction),
    initialAuthority.signingFn,
    [recoveryFeePayer],
  );
  console.log(`recovery add authority signature: ${addRecoverySignature}`);

  const configureRecoverySignature = await signAndSendPreparedTransaction(
    connection,
    requirePrepared(created.configureRecoveryTransaction),
    [recoveryFeePayer],
  );
  console.log(`recovery configure signature: ${configureRecoverySignature}`);

  await airdropIfNeeded(
    connection,
    recoveryWalletAddress,
    LAMPORTS_PER_SOL / 10,
  );

  const startForCancel = await wallet.recovery.start({
    feePayer: recoveryFeePayer.publicKey.toBase58(),
    guardianPubkey: guardian.publicKey.toBase58(),
    newAuthority: newAuthority.publicKeyHex,
  });
  const startForCancelSignature = await signAndSendPreparedTransaction(
    connection,
    startForCancel,
    [recoveryFeePayer, guardian],
  );
  console.log(
    `recovery start/cancel start signature: ${startForCancelSignature}`,
  );

  const cancel = await wallet.recovery.cancel({
    feePayer: recoveryFeePayer.publicKey.toBase58(),
  });
  const cancelSignature = await signSwigAndSendPreparedTransaction(
    connection,
    cancel,
    initialAuthority.signingFn,
    [recoveryFeePayer],
  );
  console.log(`recovery cancel signature: ${cancelSignature}`);

  const start = await wallet.recovery.start({
    feePayer: recoveryFeePayer.publicKey.toBase58(),
    guardianPubkey: guardian.publicKey.toBase58(),
    newAuthority: newAuthority.publicKeyHex,
  });
  const startSignature = await signAndSendPreparedTransaction(
    connection,
    start,
    [recoveryFeePayer, guardian],
  );
  console.log(`recovery start signature: ${startSignature}`);

  await Bun.sleep(5_000);

  const execute = await wallet.recovery.execute({
    feePayer: recoveryFeePayer.publicKey.toBase58(),
    newAuthority: newAuthority.publicKeyHex,
  });
  const executeSignature = await signAndSendPreparedTransaction(
    connection,
    execute,
    [recoveryFeePayer, guardian],
  );
  console.log(`recovery execute signature: ${executeSignature}`);

  const postRecoveryTransfer = await wallet.transfer.sol({
    feePayer: recoveryFeePayer.publicKey.toBase58(),
    requesterAuthority: {
      secp256r1: {
        publicKey: newAuthority.publicKeyHex,
      },
    },
    destination: recoveryDestination.publicKey.toBase58(),
    amount: 1_000,
  });
  const before = await connection.getBalance(recoveryDestination.publicKey);
  const postRecoveryTransferSignature =
    await signSwigAndSendPreparedTransaction(
      connection,
      postRecoveryTransfer,
      newAuthority.signingFn,
      [recoveryFeePayer],
    );
  const after = await connection.getBalance(recoveryDestination.publicKey);
  console.log(
    `recovery post-execute transfer signature: ${postRecoveryTransferSignature}`,
  );
  console.log(`recovery destination balance delta: ${after - before} lamports`);
}

async function signAndSendPreparedTransaction(
  connection: Connection,
  prepared: PreparedTransaction,
  signers: Keypair[],
): Promise<string> {
  if (
    prepared.transactionEncoding &&
    prepared.transactionEncoding !== 'base64'
  ) {
    throw new Error(
      `Unsupported transaction encoding: ${prepared.transactionEncoding}`,
    );
  }

  const transaction = deserializePreparedTransaction(prepared);
  const requiredSigners = getUnsignedRequiredSigners(transaction);
  const availableSigners = signers.filter((signer) =>
    requiredSigners.includes(signer.publicKey.toBase58()),
  );
  const availableSignerKeys = new Set(
    availableSigners.map((signer) => signer.publicKey.toBase58()),
  );
  const missingSigners = requiredSigners.filter(
    (signer) => !availableSignerKeys.has(signer),
  );

  if (missingSigners.length > 0) {
    throw new Error(
      `Prepared transaction requires unknown signer(s): ${missingSigners.join(', ')}`,
    );
  }

  if (transaction instanceof VersionedTransaction) {
    transaction.sign(availableSigners);
  } else {
    transaction.partialSign(...availableSigners);
  }

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
    },
  );
  await confirmSignature(connection, signature);
  return signature;
}

async function signSwigAndSendPreparedTransaction(
  connection: Connection,
  prepared: PreparedTransaction,
  signingFn: PasskeySigningFn,
  signers: Keypair[],
): Promise<string> {
  const signed = await signPreparedSwigTransaction(prepared, {
    secp256r1: signingFn,
  });
  return signAndSendPreparedTransaction(
    connection,
    { ...prepared, ...signed, signatureRequests: [] },
    signers,
  );
}

async function signAndSendLocalTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
): Promise<string> {
  transaction.feePayer = signers[0]?.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash('confirmed')
  ).blockhash;
  transaction.sign(...signers);

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
    },
  );
  await confirmSignature(connection, signature);
  return signature;
}

function getUnsignedRequiredSigners(
  transaction: Transaction | VersionedTransaction,
): string[] {
  if (transaction instanceof VersionedTransaction) {
    return transaction.message.staticAccountKeys
      .slice(0, transaction.message.header.numRequiredSignatures)
      .filter((_, index) => isEmptySignature(transaction.signatures[index]))
      .map((key) => key.toBase58());
  }

  const message = transaction.compileMessage();
  return message.accountKeys
    .slice(0, message.header.numRequiredSignatures)
    .filter((key) => {
      const signature = transaction.signatures.find((entry) =>
        entry.publicKey.equals(key),
      )?.signature;
      return isEmptySignature(signature);
    })
    .map((key) => key.toBase58());
}

function deserializePreparedTransaction(
  prepared: PreparedTransaction,
): Transaction | VersionedTransaction {
  const bytes = Buffer.from(prepared.transaction, 'base64');
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

async function airdropIfNeeded(
  connection: Connection,
  pubkey: PublicKey,
  minimumBalance: number,
) {
  const currentBalance = await connection.getBalance(pubkey);
  if (currentBalance >= minimumBalance) {
    return;
  }

  const signature = await connection.requestAirdrop(
    pubkey,
    minimumBalance - currentBalance,
  );
  await confirmSignature(connection, signature);
}

async function confirmSignature(connection: Connection, signature: string) {
  const result = await connection.confirmTransaction(signature, 'confirmed');

  if (result.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }
}

async function waitForAccount(connection: Connection, pubkey: PublicKey) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const account = await connection.getAccountInfo(pubkey);
    if (account) {
      return;
    }
    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for account ${pubkey.toBase58()}`);
}

async function prepareWithNest(
  handler: SwigNestHandler,
  input: { route: string; body: Record<string, unknown> },
): Promise<PreparedTransaction> {
  const response = new SmokeNestResponse();
  await handler(
    {
      body: input.body,
      headers: {
        host: 'localhost:3000',
      },
      method: 'POST',
      originalUrl: input.route,
      protocol: 'http',
    },
    response,
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `Nest handler failed with status ${response.statusCode}: ${response.body}`,
    );
  }

  const parsed = JSON.parse(response.body ?? '{}') as {
    prepared?: PreparedTransaction;
  };
  if (!parsed.prepared) {
    throw new Error(`Nest handler response is missing prepared transaction`);
  }
  return parsed.prepared;
}

class SmokeNestResponse implements SwigNestResponseLike {
  body?: string;
  statusCode = 200;

  send(body?: string) {
    this.body = body;
  }

  setHeader() {}

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }
}

function requirePrepared(
  prepared: PreparedTransaction | undefined,
): PreparedTransaction {
  if (!prepared) {
    throw new Error(
      'Create wallet response did not include a prepared transaction',
    );
  }
  return prepared;
}

function requireWalletAddress(walletAddress: string | undefined): string {
  if (!walletAddress) {
    throw new Error('Create wallet response did not include a wallet address');
  }
  return walletAddress;
}

function createP256Authority(): {
  publicKeyHex: string;
  signingFn: PasskeySigningFn;
} {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(privateKey, true);
  return {
    publicKeyHex: bytesToHex(publicKey),
    signingFn: async (message) => ({
      signature: p256.sign(message, privateKey).toCompactRawBytes(),
    }),
  };
}

function isEmptySignature(
  signature: Uint8Array | Buffer | null | undefined,
): boolean {
  return !signature || signature.every((byte) => byte === 0);
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
