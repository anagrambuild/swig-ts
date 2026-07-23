/**
 * Paymaster Jito bundle example (web3.js 1.x)
 *
 * Copy .env.example to .env.local, fill in the values, then run:
 * bun --filter swig-paymaster-examples jito:classic
 *
 * Flow:
 * 1. Create two paymaster-fee-payer memo transactions.
 * 2. Add a Jito tip instruction before collecting user signatures.
 * 3. User signs each transaction.
 * 4. Paymaster signs and submits the bundle through sponsor-bundle.
 *
 * Required env:
 * - PAYMASTER_API_KEY
 * - PAYMASTER_PUBKEY
 * - JITO_USER_KEYPAIR_1
 * - JITO_USER_KEYPAIR_2
 *
 * Optional env:
 * - PAYMASTER_BASE_URL defaults to http://localhost:8080
 * - SOLANA_RPC_URL defaults to https://api.mainnet-beta.solana.com
 * - JITO_TIP_LAMPORTS defaults to SDK default
 * - PAYMASTER_IDEMPOTENCY_KEY defaults to SDK-generated
 * - PAYMASTER_EXAMPLE_AIRDROP=true requests airdrops for unfunded accounts
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import { createPaymasterClient } from '@swig-wallet/paymaster-classic';

const PAYMASTER_API_KEY = requireEnv('PAYMASTER_API_KEY');
const PAYMASTER_PUBKEY = requireEnv('PAYMASTER_PUBKEY');
const PAYMASTER_BASE_URL =
  process.env.PAYMASTER_BASE_URL ?? 'http://localhost:8080';
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const JITO_TIP_LAMPORTS = optionalPositiveIntegerEnv('JITO_TIP_LAMPORTS');
const PAYMASTER_IDEMPOTENCY_KEY = process.env.PAYMASTER_IDEMPOTENCY_KEY;
const PAYMASTER_EXAMPLE_AIRDROP =
  process.env.PAYMASTER_EXAMPLE_AIRDROP === 'true';

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);

console.log('Paymaster Jito bundle example');
console.log(`API URL: ${PAYMASTER_BASE_URL}`);
console.log(`RPC URL: ${SOLANA_RPC_URL}`);
console.log(`Paymaster: ${PAYMASTER_PUBKEY}`);

const paymaster = createPaymasterClient({
  apiKey: PAYMASTER_API_KEY,
  paymasterPubkey: PAYMASTER_PUBKEY,
  baseUrl: PAYMASTER_BASE_URL,
  network: 'mainnet',
  customRpcUrl: SOLANA_RPC_URL,
  retryOptions: {
    maxRetries: 0,
    retryDelay: 1000,
    backoffMultiplier: 2,
  },
});

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
const paymasterPubkey = new PublicKey(PAYMASTER_PUBKEY);
await ensureAccountFunded(connection, paymasterPubkey, 'paymaster');

const users = loadJitoUserKeypairs();
for (const [index, user] of users.entries()) {
  console.log(`User ${index + 1}: ${user.publicKey.toBase58()}`);
}
await ensureUserAccountsFunded(connection, users);

const transactions = await Promise.all(
  users.map((user, index) =>
    paymaster.createLegacyTransaction([
      createMemoInstruction(`Jito bundle memo ${index + 1}`, user.publicKey),
    ]),
  ),
);

paymaster.prepareJitoBundleTransactions(transactions, {
  tipLamports: JITO_TIP_LAMPORTS,
});

for (const [index, transaction] of transactions.entries()) {
  transaction.partialSign(users[index]!);
}

const result = await paymaster.signAndSendBundle(transactions, {
  tipLamports: JITO_TIP_LAMPORTS,
  idempotencyKey: PAYMASTER_IDEMPOTENCY_KEY,
});

console.log('Bundle submitted');
console.log(`Request ID: ${result.requestId}`);
console.log(`Bundle ID: ${result.bundleId}`);
console.log(
  `Estimated spent by paymaster: ${result.estimatedSpentByPaymaster} lamports`,
);
for (const [index, signature] of result.signatures.entries()) {
  console.log(`Signature ${index + 1}: ${signature}`);
}

function createMemoInstruction(
  memo: string,
  userPublicKey: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: userPublicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo),
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalPositiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function loadJitoUserKeypairs(): Keypair[] {
  return [
    keypairFromSecretKeyEnv('JITO_USER_KEYPAIR_1'),
    keypairFromSecretKeyEnv('JITO_USER_KEYPAIR_2'),
  ];
}

function keypairFromSecretKeyEnv(name: string): Keypair {
  const value = requireEnv(name).trim();
  const json =
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
      ? value.slice(1, -1)
      : value;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `${name} must be a JSON array secret key: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 64 ||
    !parsed.every(
      (value) =>
        Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255,
    )
  ) {
    throw new Error(`${name} must be a JSON array of 64 byte values`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

async function ensureUserAccountsFunded(
  connection: Connection,
  users: Keypair[],
): Promise<void> {
  for (const user of users) {
    await ensureAccountFunded(connection, user.publicKey, 'user');
  }
}

async function ensureAccountFunded(
  connection: Connection,
  account: PublicKey,
  label: string,
): Promise<void> {
  const startingBalance = await connection.getBalance(account);
  if (startingBalance > 0) {
    console.log(
      `${label} funded: ${account.toBase58()} (${startingBalance} lamports)`,
    );
    return;
  }

  if (!PAYMASTER_EXAMPLE_AIRDROP) {
    throw new Error(
      `${label} is unfunded: ${account.toBase58()}. Fund it or set PAYMASTER_EXAMPLE_AIRDROP=true for local airdrop testing.`,
    );
  }

  console.log(`Funding ${label} by airdrop: ${account.toBase58()}`);
  const signature = await connection.requestAirdrop(account, LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature, 'confirmed');
  await waitForBalance(connection, account);
}

async function waitForBalance(
  connection: Connection,
  account: PublicKey,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const balance = await connection.getBalance(account);
    if (balance > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Airdrop did not fund ${account.toBase58()}`);
}
