import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  SwigClient,
  type PreparedTransaction,
} from '@swig-wallet/developer-sdk';

const apiBaseUrl =
  process.env.SWIG_TRANSACTION_API_URL ?? 'http://localhost:8080';
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://swig:swig@localhost:55432/swig';
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'http://localhost:8899';
const shouldSubmit = process.env.SWIG_LOCAL_SMOKE_SUBMIT !== 'false';
const runId = randomUUID();
const apiKey = `sk_local_transaction_smoke_${runId}`;
const userId = `local-smoke-user-${runId}`;
const organizationId = `local-smoke-org-${runId}`;
const apiKeyId = `local-smoke-api-key-${runId}`;
const signerId = `local-smoke-signer-${runId}`;
const permissionId = `local-smoke-permission-${runId}`;
const policyId = `local-smoke-policy-${runId}`;
const feePayer = Keypair.generate();
const requester = Keypair.generate();
const destination = Keypair.generate();

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

  if (shouldSubmit) {
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
  }

  const transferTransaction = await wallet.transfer({
    feePayer: feePayer.publicKey.toBase58(),
    requesterPubkey: requester.publicKey.toBase58(),
    destination: destination.publicKey.toBase58(),
    amount: 1_000,
  });
  console.log(`transfer intent: ${transferTransaction.intentId}`);

  if (shouldSubmit) {
    const before = await connection.getBalance(destination.publicKey);
    const transferSignature = await signAndSendPreparedTransaction(
      connection,
      transferTransaction,
      [feePayer, requester],
    );
    const after = await connection.getBalance(destination.publicKey);
    console.log(`transfer signature: ${transferSignature}`);
    console.log(`destination balance delta: ${after - before} lamports`);
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

INSERT INTO signers (
  id,
  "organizationId",
  name,
  type,
  "publicKey",
  "createdById",
  "lastUpdatedById",
  "updatedAt"
)
VALUES (
  ${sqlLiteral(signerId)},
  ${sqlLiteral(organizationId)},
  'Local Smoke Signer',
  'ED25519',
  ${sqlLiteral(requester.publicKey.toBase58())},
  ${sqlLiteral(userId)},
  ${sqlLiteral(userId)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "updatedAt" = NOW(),
  "publicKey" = EXCLUDED."publicKey";

INSERT INTO permissions (
  id,
  "organizationId",
  name,
  actions,
  "createdById",
  "lastUpdatedById",
  "updatedAt"
)
VALUES (
  ${sqlLiteral(permissionId)},
  ${sqlLiteral(organizationId)},
  'Local Smoke Permission',
  '[{"type":"All"}]'::jsonb,
  ${sqlLiteral(userId)},
  ${sqlLiteral(userId)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "updatedAt" = NOW(),
  actions = EXCLUDED.actions;

INSERT INTO policies (
  id,
  "organizationId",
  name,
  "signerId",
  "permissionId",
  "createdById",
  "lastUpdatedById",
  "updatedAt"
)
VALUES (
  ${sqlLiteral(policyId)},
  ${sqlLiteral(organizationId)},
  'Local Smoke Policy',
  ${sqlLiteral(signerId)},
  ${sqlLiteral(permissionId)},
  ${sqlLiteral(userId)},
  ${sqlLiteral(userId)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "updatedAt" = NOW(),
  "signerId" = EXCLUDED."signerId",
  "permissionId" = EXCLUDED."permissionId";

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

  const transaction = Transaction.from(
    Buffer.from(prepared.transaction, 'base64'),
  );
  const message = transaction.compileMessage();
  const requiredSigners = message.accountKeys
    .slice(0, message.header.numRequiredSignatures)
    .map((key) => key.toBase58());
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

  transaction.partialSign(...availableSigners);

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
    },
  );
  await confirmSignature(connection, signature);
  return signature;
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

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
