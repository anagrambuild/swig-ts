import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

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
  createSwigNestHandler,
  type SwigNestHandler,
  type SwigNestResponseLike,
} from '../src/server/nest.js';

const apiBaseUrl = 'http://localhost:8080';
const databaseUrl = 'postgres://swig:swig@localhost:55432/swig';
const rpcUrl = 'http://localhost:8899';
const swapAmountLamports = 10_000_000;
const swapSlippageBps = 1_000;
const runId = randomUUID();
const apiKey = `sk_local_transaction_smoke_${runId}`;
const userId = `local-smoke-user-${runId}`;
const organizationId = `local-smoke-org-${runId}`;
const apiKeyId = `local-smoke-api-key-${runId}`;
const policyId = `local-smoke-policy-${runId}`;
const feePayer = Keypair.generate();
const requester = Keypair.generate();
const destination = Keypair.generate();
const solMint = 'So11111111111111111111111111111111111111112';
const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

await main();

async function main() {
  const connection = new Connection(rpcUrl, 'confirmed');

  seedLocalFixture();
  await airdropIfNeeded(connection, feePayer.publicKey, LAMPORTS_PER_SOL);

  const swig = new SwigClient({
    apiKey,
    baseUrl: apiBaseUrl,
    network: 'devnet',
  });

  console.log(`local transaction smoke: ${runId}`);
  console.log(`api: ${apiBaseUrl}`);
  console.log(`rpc: ${rpcUrl}`);
  console.log(`policy: ${policyId}`);
  console.log(`fee payer: ${feePayer.publicKey.toBase58()}`);
  console.log(`requester: ${requester.publicKey.toBase58()}`);

  const wallet = await swig.wallets.create({
    feePayer: feePayer.publicKey.toBase58(),
    policyId,
  });
  const createTransaction = requirePrepared(wallet.creationTransaction);
  console.log(`create intent: ${createTransaction.intentId}`);
  console.log(`swig config: ${wallet.swigConfigAddress}`);
  console.log(`wallet: ${requireWalletAddress(wallet.walletAddress)}`);

  const createSignature = await signAndSendPreparedTransaction(
    connection,
    createTransaction,
    [feePayer],
  );
  console.log(`create signature: ${createSignature}`);
  await waitForAccount(connection, new PublicKey(wallet.swigConfigAddress));
  await airdropIfNeeded(
    connection,
    new PublicKey(requireWalletAddress(wallet.walletAddress)),
    LAMPORTS_PER_SOL / 10,
  );

  const transferTransaction = await wallet.transfer({
    feePayer: feePayer.publicKey.toBase58(),
    requesterPubkey: requester.publicKey.toBase58(),
    destination: destination.publicKey.toBase58(),
    amount: 1_000,
  });
  console.log(`transfer intent: ${transferTransaction.intentId}`);

  const before = await connection.getBalance(destination.publicKey);
  const transferSignature = await signAndSendPreparedTransaction(
    connection,
    transferTransaction,
    [feePayer, requester],
  );
  const after = await connection.getBalance(destination.publicKey);
  console.log(`transfer signature: ${transferSignature}`);
  console.log(`destination balance delta: ${after - before} lamports`);

  const swapTransaction = await wallet.swap({
    feePayer: feePayer.publicKey.toBase58(),
    requesterPubkey: requester.publicKey.toBase58(),
    inputMint: solMint,
    outputMint: usdcMint,
    amount: swapAmountLamports,
    slippageBps: swapSlippageBps,
    wrapAndUnwrapSol: true,
    maxAccounts: 20,
    mode: 'fast',
  });
  console.log(`swap intent: ${swapTransaction.intentId}`);
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
    resolveRequesterPubkey: () => requester.publicKey.toBase58(),
  });
  const nestTransferTransaction = await prepareWithNest(nestHandler, {
    route: '/swig/transfer/sol',
    body: {
      wallet: {
        swigId: wallet.swigId,
        swigConfigAddress: wallet.swigConfigAddress,
        walletAddress: wallet.walletAddress,
      },
      network: 'devnet',
      destination: Keypair.generate().publicKey.toBase58(),
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
        swigId: wallet.swigId,
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

INSERT INTO "wallet_policy_templates" (
  id,
  "organizationId",
  name,
  "initialUserLabel",
  "initialAuthoritySource",
  "initialAuthority",
  "initialActions",
  "guardianEnabled",
  "guardianDelaySeconds",
  "createdById",
  "lastUpdatedById",
  "updatedAt"
)
VALUES (
  ${sqlLiteral(policyId)},
  ${sqlLiteral(organizationId)},
  'Local Smoke Wallet Policy',
  'Local Smoke Signer',
  2,
  decode(${sqlLiteral(encodeEd25519WalletAuthorityHex(requester.publicKey.toBase58()))}, 'hex'),
  '[{"type":"All"}]'::jsonb,
  FALSE,
  0,
  ${sqlLiteral(userId)},
  ${sqlLiteral(userId)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "updatedAt" = NOW(),
  "initialAuthority" = EXCLUDED."initialAuthority",
  "initialActions" = EXCLUDED."initialActions",
  "guardianEnabled" = EXCLUDED."guardianEnabled";

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
  const requiredSigners = getRequiredSigners(transaction);
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

function getRequiredSigners(
  transaction: Transaction | VersionedTransaction,
): string[] {
  if (transaction instanceof VersionedTransaction) {
    return transaction.message.staticAccountKeys
      .slice(0, transaction.message.header.numRequiredSignatures)
      .map((key) => key.toBase58());
  }

  const message = transaction.compileMessage();
  return message.accountKeys
    .slice(0, message.header.numRequiredSignatures)
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

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function encodeEd25519WalletAuthorityHex(publicKey: string): string {
  const authorityMessage = encodeProtoMessage([
    [1, Buffer.from(publicKey, 'utf8')],
  ]);
  return encodeProtoMessage([[1, authorityMessage]]).toString('hex');
}

function encodeProtoMessage(fields: Array<[number, Buffer]>): Buffer {
  return Buffer.concat(
    fields.flatMap(([fieldNumber, value]) => [
      encodeVarint((fieldNumber << 3) | 2),
      encodeVarint(value.length),
      value,
    ]),
  );
}

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let current = value;
  while (current >= 0x80) {
    bytes.push((current & 0x7f) | 0x80);
    current >>= 7;
  }
  bytes.push(current);
  return Buffer.from(bytes);
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
