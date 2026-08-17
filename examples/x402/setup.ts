import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
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
import type { PreparedTransaction } from '@swig-wallet/developer-sdk';
import { SwigClient } from '@swig-wallet/developer-sdk/server/typescript';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const X402_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as const;

const DEFAULT_BACKEND_URL = 'https://backend.prod.infra.onswig.com';
const DEFAULT_FACILITATOR_PORT = 4022;
const DEFAULT_RESOURCE_SERVER_PORT = 4021;
const MINIMUM_FACILITATOR_BALANCE = LAMPORTS_PER_SOL;
const MAX_U64 = 18_446_744_073_709_551_615n;

const STATE_DIRECTORY = new URL('./.local/', import.meta.url);
const STATE_FILE = new URL('./.local/state.json', import.meta.url);

interface SetupState {
  facilitatorSecretKey?: number[];
  developerSecretKey?: number[];
  resourceProviderSecretKey?: number[];
  mintSecretKey?: number[];
  swigConfigAddress?: string;
  swigWalletAddress?: string;
  developerPublicKey?: string;
}

export interface ReadyX402Fixture {
  rpcUrl: string;
  backendUrl: string;
  apiKey: string;
  network: 'devnet';
  x402Network: typeof X402_DEVNET;
  facilitator: Keypair;
  developer: Keypair;
  resourceProvider: Keypair;
  mint: PublicKey;
  tokenProgram: PublicKey;
  swigConfigAddress: string;
  swigWalletAddress: string;
  paymentAmount: bigint;
  facilitatorPort: number;
  resourceServerPort: number;
}

export async function ensureX402Fixture(): Promise<ReadyX402Fixture> {
  const rpcUrl = requiredEnvironment('SOLANA_RPC_URL');
  const backendUrl = process.env.SWIG_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  const apiKey = requiredEnvironment('SWIG_API_KEY');
  const state = loadState();
  const facilitator = keypairFromEnvironmentOrState(
    'X402_FACILITATOR_KEYPAIR',
    state.facilitatorSecretKey,
  );
  const developer = keypairFromEnvironmentOrState(
    'X402_DEVELOPER_KEYPAIR',
    state.developerSecretKey,
  );
  const resourceProvider = keypairFromEnvironmentOrState(
    'X402_RESOURCE_PROVIDER_KEYPAIR',
    state.resourceProviderSecretKey,
  );
  state.facilitatorSecretKey = [...facilitator.secretKey];
  state.developerSecretKey = [...developer.secretKey];
  state.resourceProviderSecretKey = [...resourceProvider.secretKey];
  saveState(state);

  const paymentAmount = atomicAmountFromEnvironment(
    'X402_PAYMENT_AMOUNT',
    '1000',
  );
  const facilitatorPort = portFromEnvironment(
    'X402_FACILITATOR_PORT',
    DEFAULT_FACILITATOR_PORT,
  );
  const resourceServerPort = portFromEnvironment(
    'X402_RESOURCE_SERVER_PORT',
    DEFAULT_RESOURCE_SERVER_PORT,
  );

  const connection = new Connection(rpcUrl, 'confirmed');

  await ensureFacilitatorBalance(connection, facilitator);

  const swig = await ensureSwig({
    connection,
    state,
    apiKey,
    backendUrl,
    facilitator,
    developer,
  });
  const mint = await ensureMint({
    connection,
    state,
    facilitator,
    paymentAmount,
  });

  await ensureTokenAccounts({
    connection,
    facilitator,
    resourceProvider,
    mint: mint.address,
    tokenProgram: mint.tokenProgram,
    swigWalletAddress: new PublicKey(swig.walletAddress),
    requiredBalance: paymentAmount,
  });

  saveState(state);

  return {
    rpcUrl,
    backendUrl,
    apiKey,
    network: 'devnet',
    x402Network: X402_DEVNET,
    facilitator,
    developer,
    resourceProvider,
    mint: mint.address,
    tokenProgram: mint.tokenProgram,
    swigConfigAddress: swig.configAddress,
    swigWalletAddress: swig.walletAddress,
    paymentAmount,
    facilitatorPort,
    resourceServerPort,
  };
}

async function ensureSwig(args: {
  connection: Connection;
  state: SetupState;
  apiKey: string;
  backendUrl: string;
  facilitator: Keypair;
  developer: Keypair;
}): Promise<{ configAddress: string; walletAddress: string }> {
  const configuredConfig = process.env.SWIG_CONFIG_ADDRESS;
  const configuredWallet = process.env.SWIG_WALLET_ADDRESS;

  if ((configuredConfig === undefined) !== (configuredWallet === undefined)) {
    throw new Error(
      'SWIG_CONFIG_ADDRESS and SWIG_WALLET_ADDRESS must be supplied together',
    );
  }

  const explicitSwig =
    configuredConfig && configuredWallet
      ? {
          configAddress: configuredConfig,
          walletAddress: configuredWallet,
        }
      : undefined;
  const rememberedSwig =
    args.state.swigConfigAddress &&
    args.state.swigWalletAddress &&
    (!args.state.developerPublicKey ||
      args.state.developerPublicKey === args.developer.publicKey.toBase58())
      ? {
          configAddress: args.state.swigConfigAddress,
          walletAddress: args.state.swigWalletAddress,
        }
      : undefined;
  const candidate = explicitSwig ?? rememberedSwig;

  if (candidate) {
    const [configAccount, walletAccount] = await Promise.all([
      args.connection.getAccountInfo(
        new PublicKey(candidate.configAddress),
        'confirmed',
      ),
      args.connection.getAccountInfo(
        new PublicKey(candidate.walletAddress),
        'confirmed',
      ),
    ]);

    if (configAccount && walletAccount) {
      return candidate;
    }

    if (explicitSwig) {
      throw new Error(
        'The Swig supplied through the environment does not exist',
      );
    }
  }

  const swig = new SwigClient({
    apiKey: args.apiKey,
    baseUrl: args.backendUrl,
    network: 'devnet',
  });
  const created = await swig.wallets.create({
    feePayer: args.facilitator.publicKey.toBase58(),
    initialUser: {
      ed25519: { publicKey: args.developer.publicKey.toBase58() },
    },
  });

  if (!created.creationTransaction) {
    throw new Error('Wallet creation response is missing its transaction');
  }
  if (!created.wallet.walletAddress) {
    throw new Error('Wallet creation response is missing walletAddress');
  }

  await signAndSendPreparedTransaction(
    args.connection,
    created.creationTransaction,
    args.facilitator,
  );
  await waitForAccount(
    args.connection,
    new PublicKey(created.wallet.swigConfigAddress),
  );

  args.state.swigConfigAddress = created.wallet.swigConfigAddress;
  args.state.swigWalletAddress = created.wallet.walletAddress;
  args.state.developerPublicKey = args.developer.publicKey.toBase58();
  saveState(args.state);

  return {
    configAddress: created.wallet.swigConfigAddress,
    walletAddress: created.wallet.walletAddress,
  };
}

async function ensureMint(args: {
  connection: Connection;
  state: SetupState;
  facilitator: Keypair;
  paymentAmount: bigint;
}): Promise<{ address: PublicKey; tokenProgram: PublicKey }> {
  const configuredMint = process.env.X402_MINT;

  if (configuredMint) {
    const address = new PublicKey(configuredMint);
    const account = await args.connection.getAccountInfo(address, 'confirmed');

    if (!account) {
      throw new Error('X402_MINT does not exist');
    }

    const tokenProgram = requireTokenProgram(account.owner);
    await getMint(args.connection, address, 'confirmed', tokenProgram);
    return { address, tokenProgram };
  }

  const decimals = decimalsForPaymentAmount(args.paymentAmount);
  let mint = args.state.mintSecretKey
    ? Keypair.fromSecretKey(Uint8Array.from(args.state.mintSecretKey))
    : Keypair.generate();
  let existing = await args.connection.getAccountInfo(
    mint.publicKey,
    'confirmed',
  );

  if (existing) {
    const mintState = await getMint(
      args.connection,
      mint.publicKey,
      'confirmed',
      TOKEN_PROGRAM_ID,
    );

    if (
      mintState.decimals === decimals &&
      mintState.mintAuthority?.equals(args.facilitator.publicKey)
    ) {
      return { address: mint.publicKey, tokenProgram: TOKEN_PROGRAM_ID };
    }

    mint = Keypair.generate();
    existing = null;
  }

  args.state.mintSecretKey = Array.from(mint.secretKey);
  saveState(args.state);

  if (!existing) {
    await createMint(
      args.connection,
      args.facilitator,
      args.facilitator.publicKey,
      null,
      decimals,
      mint,
      { commitment: 'confirmed' },
      TOKEN_PROGRAM_ID,
    );
  }

  return { address: mint.publicKey, tokenProgram: TOKEN_PROGRAM_ID };
}

async function ensureTokenAccounts(args: {
  connection: Connection;
  facilitator: Keypair;
  resourceProvider: Keypair;
  mint: PublicKey;
  tokenProgram: PublicKey;
  swigWalletAddress: PublicKey;
  requiredBalance: bigint;
}): Promise<void> {
  const sourceTokenAccount = await getAssociatedTokenAddress(
    args.mint,
    args.swigWalletAddress,
    true,
    args.tokenProgram,
  );
  const resourceProviderTokenAccount = await getAssociatedTokenAddress(
    args.mint,
    args.resourceProvider.publicKey,
    false,
    args.tokenProgram,
  );
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      args.facilitator.publicKey,
      sourceTokenAccount,
      args.swigWalletAddress,
      args.mint,
      args.tokenProgram,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      args.facilitator.publicKey,
      resourceProviderTokenAccount,
      args.resourceProvider.publicKey,
      args.mint,
      args.tokenProgram,
    ),
  );

  await signAndSendTransaction(args.connection, transaction, args.facilitator);

  const source = await getAccount(
    args.connection,
    sourceTokenAccount,
    'confirmed',
    args.tokenProgram,
  );
  if (source.amount >= args.requiredBalance) {
    return;
  }

  const mint = await getMint(
    args.connection,
    args.mint,
    'confirmed',
    args.tokenProgram,
  );
  if (!mint.mintAuthority?.equals(args.facilitator.publicKey)) {
    throw new Error(
      'The Swig source account has insufficient tokens and the facilitator is not the mint authority',
    );
  }

  await mintTo(
    args.connection,
    args.facilitator,
    args.mint,
    sourceTokenAccount,
    args.facilitator,
    args.requiredBalance - source.amount,
    [],
    { commitment: 'confirmed' },
    args.tokenProgram,
  );
}

async function ensureFacilitatorBalance(
  connection: Connection,
  facilitator: Keypair,
): Promise<void> {
  const balance = await connection.getBalance(
    facilitator.publicKey,
    'confirmed',
  );
  if (balance >= MINIMUM_FACILITATOR_BALANCE) {
    return;
  }

  const signature = await connection.requestAirdrop(
    facilitator.publicKey,
    MINIMUM_FACILITATOR_BALANCE,
  );
  await confirmSignature(connection, signature);
}

async function signAndSendPreparedTransaction(
  connection: Connection,
  prepared: PreparedTransaction,
  signer: Keypair,
): Promise<void> {
  const bytes = Buffer.from(prepared.transaction, 'base64');
  let transaction: Transaction | VersionedTransaction;

  try {
    transaction = VersionedTransaction.deserialize(bytes);
  } catch {
    transaction = Transaction.from(bytes);
  }

  if (transaction instanceof VersionedTransaction) {
    transaction.sign([signer]);
  } else {
    transaction.partialSign(signer);
  }

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
  );
  await confirmSignature(connection, signature);
}

async function signAndSendTransaction(
  connection: Connection,
  transaction: Transaction,
  signer: Keypair,
): Promise<void> {
  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = signer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(signer);

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
  );
  const result = await connection.confirmTransaction(
    { signature, ...latest },
    'confirmed',
  );

  if (result.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }
}

async function confirmSignature(
  connection: Connection,
  signature: string,
): Promise<void> {
  const result = await connection.confirmTransaction(signature, 'confirmed');
  if (result.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }
}

async function waitForAccount(
  connection: Connection,
  address: PublicKey,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await connection.getAccountInfo(address, 'confirmed')) {
      return;
    }
    await Bun.sleep(250);
  }

  throw new Error(`Timed out waiting for ${address.toBase58()}`);
}

function decimalsForPaymentAmount(amount: bigint): number {
  return amount.toString().length - 1;
}

function atomicAmountFromEnvironment(name: string, fallback: string): bigint {
  const raw = process.env[name] ?? fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`${name} must be a canonical positive integer`);
  }

  const amount = BigInt(raw);
  if (amount > MAX_U64) {
    throw new Error(`${name} exceeds u64`);
  }
  return amount;
}

function requireTokenProgram(owner: PublicKey): PublicKey {
  if (owner.equals(TOKEN_PROGRAM_ID)) {
    return TOKEN_PROGRAM_ID;
  }
  if (owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID;
  }
  throw new Error('X402_MINT is not owned by a supported token program');
}

function loadState(): SetupState {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as SetupState & {
    requesterSecretKey?: number[];
    merchantSecretKey?: number[];
  };

  state.developerSecretKey ??= state.requesterSecretKey;
  state.resourceProviderSecretKey ??= state.merchantSecretKey;
  delete state.requesterSecretKey;
  delete state.merchantSecretKey;

  return state;
}

function saveState(state: SetupState): void {
  mkdirSync(STATE_DIRECTORY, { recursive: true });
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function keypairFromEnvironmentOrState(
  name: string,
  rememberedSecretKey: number[] | undefined,
): Keypair {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return rememberedSecretKey === undefined
      ? Keypair.generate()
      : keypairFromSecretKey(name, rememberedSecretKey);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be a JSON secret-key array`);
  }

  return keypairFromSecretKey(name, parsed);
}

function keypairFromSecretKey(name: string, value: unknown): Keypair {
  if (
    !Array.isArray(value) ||
    value.length !== 64 ||
    !value.every(
      (byte) =>
        Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255,
    )
  ) {
    throw new Error(`${name} must contain 64 byte values`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(value));
}

function portFromEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port`);
  }
  return port;
}

if (import.meta.main) {
  const fixture = await ensureX402Fixture();
  console.log('x402 fixture is ready');
  console.log(`RPC: ${fixture.rpcUrl}`);
  console.log(`Swig config: ${fixture.swigConfigAddress}`);
  console.log(`Swig wallet: ${fixture.swigWalletAddress}`);
  console.log(`Developer: ${fixture.developer.publicKey.toBase58()}`);
  console.log(
    `Resource provider: ${fixture.resourceProvider.publicKey.toBase58()}`,
  );
  console.log(`Facilitator: ${fixture.facilitator.publicKey.toBase58()}`);
  console.log(`Mint: ${fixture.mint.toBase58()}`);
  console.log(
    `Payment amount: ${fixture.paymentAmount.toString()} atomic units`,
  );
}
