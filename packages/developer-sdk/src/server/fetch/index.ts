import type {
  Amount,
  CreateWalletArgs,
  Network,
  SwapArgs,
  TransferTokenArgs,
  WalletReference,
} from '../../types/index.js';
import { SwigClient } from '../typescript/index.js';

export type SwigProxyRoute =
  | 'wallet/create'
  | 'transfer/sol'
  | 'transfer/spl-token'
  | 'swap/jupiter';

export interface SwigRouteContext {
  request: Request;
  route: SwigProxyRoute;
  body: Record<string, unknown>;
  wallet?: WalletReference;
  network?: Network;
}

export interface CreateSwigFetchHandlerConfig {
  apiKey?: string;
  transactionApiUrl?: string;
  /**
   * Deprecated alias for transactionApiUrl.
   */
  baseUrl?: string;
  network?: Network;
  feePayer?:
    | string
    | ((context: SwigRouteContext) => MaybePromise<string | undefined>);
  resolveRequesterPubkey?: (
    context: SwigRouteContext,
  ) => MaybePromise<string | undefined>;
  fetch?: typeof fetch;
}

type MaybePromise<T> = T | Promise<T>;

class SwigRouteError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
  }
}

const swigProxyRoutes: SwigProxyRoute[] = [
  'wallet/create',
  'transfer/sol',
  'transfer/spl-token',
  'swap/jupiter',
];

export type SwigFetchHandler = (request: Request) => Promise<Response>;

export function createSwigFetchHandler(
  config: CreateSwigFetchHandlerConfig = {},
): SwigFetchHandler {
  return (request: Request) => handlePost(request, config);
}

async function handlePost(
  request: Request,
  config: CreateSwigFetchHandlerConfig,
): Promise<Response> {
  try {
    const route = resolveRoute(request);
    const body = await readJsonObject(request);
    const network = readNetwork(body.network) ?? config.network;
    const wallet = readWallet(body.wallet);
    const context: SwigRouteContext = {
      request,
      route,
      body,
      wallet,
      network,
    };
    const apiKey = resolveApiKey(config);
    const transactionApiUrl = resolveTransactionApiUrl(config);
    const swig = new SwigClient({
      apiKey,
      ...(transactionApiUrl ? { baseUrl: transactionApiUrl } : {}),
      ...(network ? { network } : {}),
      ...(config.fetch ? { fetch: config.fetch } : {}),
    });

    switch (route) {
      case 'wallet/create':
        return json({
          prepared: await prepareWalletCreation(swig, body, context, config),
        });
      case 'transfer/sol':
        return json({
          prepared: await prepareSolTransfer(swig, body, context, config),
        });
      case 'transfer/spl-token':
        return json({
          prepared: await prepareTokenTransfer(swig, body, context, config),
        });
      case 'swap/jupiter':
        return json({
          prepared: await prepareJupiterSwap(swig, body, context, config),
        });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to prepare transaction';
    const status = error instanceof SwigRouteError ? error.status : 400;
    return json({ error: message }, status);
  }
}

async function prepareWalletCreation(
  swig: SwigClient,
  body: Record<string, unknown>,
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
) {
  const feePayer = await resolveFeePayer(context, config);
  const policyId = readOptionalString(body, 'policyId');
  const initialUser = readWalletAuthority(body.initialUser);
  if (!policyId && !initialUser) {
    throw new SwigRouteError('policyId or initialUser is required');
  }

  const args: CreateWalletArgs = {
    feePayer,
    ...(policyId ? { policyId } : {}),
    ...(initialUser ? { initialUser } : {}),
    ...(readOptionalString(body, 'guardianPubkey')
      ? { guardianPubkey: readOptionalString(body, 'guardianPubkey') }
      : {}),
    ...(context.network ? { network: context.network } : {}),
    ...(readOptionalString(body, 'idempotencyKey')
      ? { idempotencyKey: readOptionalString(body, 'idempotencyKey') }
      : {}),
  };
  const wallet = await swig.wallets.create(args);

  if (!wallet.creationTransaction) {
    throw new SwigRouteError(
      'Wallet creation response is missing transaction',
      502,
    );
  }

  return createWalletResult(wallet);
}

function createWalletResult(
  wallet: Awaited<ReturnType<SwigClient['wallets']['create']>>,
) {
  const intentId =
    wallet.creationTransaction?.intentId ??
    wallet.creationTransactions[0]?.intentId;

  return {
    intentId,
    wallet: {
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      network: wallet.network,
    },
    transactions: wallet.creationTransactions,
    creationTransaction: wallet.creationTransaction,
    addAuthorityChallenge: wallet.addAuthorityChallenge,
    network: wallet.network,
  };
}

async function prepareSolTransfer(
  swig: SwigClient,
  body: Record<string, unknown>,
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
) {
  const wallet = requireWallet(context.wallet);
  const requesterPubkey = await resolveRequesterPubkey(context, config);
  const feePayer = await resolveFeePayer(context, config, requesterPubkey);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterPubkey,
    },
    { network: context.network },
  );

  return handle.transfer({
    feePayer,
    requesterPubkey,
    destination: readRequiredString(body, 'destination'),
    amount: readAmount(body),
    ...(context.network ? { network: context.network } : {}),
    ...(readOptionalString(body, 'idempotencyKey')
      ? { idempotencyKey: readOptionalString(body, 'idempotencyKey') }
      : {}),
  });
}

async function prepareTokenTransfer(
  swig: SwigClient,
  body: Record<string, unknown>,
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
) {
  const wallet = requireWallet(context.wallet);
  const requesterPubkey = await resolveRequesterPubkey(context, config);
  const feePayer = await resolveFeePayer(context, config, requesterPubkey);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterPubkey,
    },
    { network: context.network },
  );
  const args: TransferTokenArgs = {
    feePayer,
    requesterPubkey,
    mint: readRequiredString(body, 'mint'),
    destinationOwner: readRequiredString(body, 'destinationOwner'),
    amount: readAmount(body),
    ...(context.network ? { network: context.network } : {}),
    ...(readOptionalString(body, 'idempotencyKey')
      ? { idempotencyKey: readOptionalString(body, 'idempotencyKey') }
      : {}),
  };

  return handle.transfer(args);
}

async function prepareJupiterSwap(
  swig: SwigClient,
  body: Record<string, unknown>,
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
) {
  const wallet = requireWallet(context.wallet);
  const requesterPubkey = await resolveRequesterPubkey(context, config);
  const feePayer = await resolveFeePayer(context, config, requesterPubkey);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterPubkey,
    },
    { network: context.network },
  );
  const args: SwapArgs = {
    feePayer,
    requesterPubkey,
    inputMint: readRequiredString(body, 'inputMint'),
    outputMint: readRequiredString(body, 'outputMint'),
    amount: readAmount(body),
    ...(readOptionalNumber(body, 'slippageBps') !== undefined
      ? { slippageBps: readOptionalNumber(body, 'slippageBps') }
      : {}),
    ...(readOptionalString(body, 'destinationTokenAccount')
      ? {
          destinationTokenAccount: readOptionalString(
            body,
            'destinationTokenAccount',
          ),
        }
      : {}),
    ...(readOptionalString(body, 'nativeDestinationAccount')
      ? {
          nativeDestinationAccount: readOptionalString(
            body,
            'nativeDestinationAccount',
          ),
        }
      : {}),
    ...(readOptionalBoolean(body, 'wrapAndUnwrapSol') !== undefined
      ? { wrapAndUnwrapSol: readOptionalBoolean(body, 'wrapAndUnwrapSol') }
      : {}),
    ...(readOptionalString(body, 'tipAmountLamports')
      ? { tipAmountLamports: readOptionalString(body, 'tipAmountLamports') }
      : {}),
    ...(readOptionalString(body, 'computeUnitPricePercentile')
      ? {
          computeUnitPricePercentile: readOptionalString(
            body,
            'computeUnitPricePercentile',
          ),
        }
      : {}),
    ...(readOptionalNumber(body, 'maxAccounts') !== undefined
      ? { maxAccounts: readOptionalNumber(body, 'maxAccounts') }
      : {}),
    ...(readOptionalString(body, 'mode')
      ? { mode: readOptionalString(body, 'mode') }
      : {}),
    ...(readOptionalNumber(body, 'blockhashSlotsToExpiry') !== undefined
      ? {
          blockhashSlotsToExpiry: readOptionalNumber(
            body,
            'blockhashSlotsToExpiry',
          ),
        }
      : {}),
    ...(context.network ? { network: context.network } : {}),
    ...(readOptionalString(body, 'idempotencyKey')
      ? { idempotencyKey: readOptionalString(body, 'idempotencyKey') }
      : {}),
  };

  return handle.swap(args);
}

async function resolveRequesterPubkey(
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
): Promise<string> {
  const requesterPubkey =
    context.wallet?.requesterPubkey ??
    readOptionalString(context.body, 'requesterPubkey') ??
    (await config.resolveRequesterPubkey?.(context)) ??
    readEnv('SWIG_REQUESTER_PUBKEY', 'SWIG_AUTHORITY_PUBLIC_KEY');

  if (!requesterPubkey) {
    throw new SwigRouteError('requesterPubkey is required');
  }

  return requesterPubkey;
}

async function resolveFeePayer(
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
  requesterPubkey?: string,
): Promise<string> {
  const configuredFeePayer =
    typeof config.feePayer === 'function'
      ? await config.feePayer(context)
      : config.feePayer;
  const feePayer =
    configuredFeePayer ??
    readOptionalString(context.body, 'feePayer') ??
    readEnv(
      'SWIG_FEE_PAYER',
      'SWIG_TRANSFER_FEE_PAYER',
      'SWIG_TRANSACTION_FEE_PAYER',
    ) ??
    requesterPubkey;

  if (!feePayer) {
    throw new SwigRouteError('feePayer is required');
  }

  return feePayer;
}

function resolveApiKey(config: CreateSwigFetchHandlerConfig): string {
  const apiKey =
    config.apiKey ?? readEnv('SWIG_DEVELOPER_API_KEY', 'SWIG_API_KEY');
  if (!apiKey) {
    throw new SwigRouteError('SWIG_DEVELOPER_API_KEY is required', 500);
  }
  return apiKey;
}

function resolveTransactionApiUrl(config: CreateSwigFetchHandlerConfig) {
  return (
    config.transactionApiUrl ??
    config.baseUrl ??
    readEnv(
      'SWIG_TRANSACTION_API_URL',
      'SWIG_BACKEND_URL',
      'NEXT_PUBLIC_SWIG_BACKEND_URL',
    )
  );
}

function resolveRoute(request: Request): SwigProxyRoute {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '');
  const route = swigProxyRoutes.find(
    (candidate) =>
      pathname === `/${candidate}` || pathname.endsWith(`/${candidate}`),
  );

  if (!route) {
    throw new SwigRouteError('Unsupported Swig route', 404);
  }

  return route;
}

async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const body = (await request.json()) as unknown;
  if (!isRecord(body)) {
    throw new SwigRouteError('Request body must be a JSON object');
  }
  return body;
}

function readWallet(value: unknown): WalletReference | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new SwigRouteError('wallet must be an object');
  }

  return {
    swigConfigAddress: readRequiredString(value, 'swigConfigAddress'),
    walletAddress: readOptionalString(value, 'walletAddress'),
    requesterPubkey: readOptionalString(value, 'requesterPubkey'),
    network: readNetwork(value.network),
  };
}

function readWalletAuthority(value: unknown): CreateWalletArgs['initialUser'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new SwigRouteError('initialUser must be an object');
  }
  for (const scheme of ['ed25519', 'secp256k1', 'secp256r1'] as const) {
    const authority = value[scheme];
    if (!isRecord(authority)) {
      continue;
    }
    const publicKey = readOptionalString(authority, 'publicKey');
    if (publicKey) {
      return { [scheme]: { publicKey } } as CreateWalletArgs['initialUser'];
    }
  }
  throw new SwigRouteError('initialUser must include a supported authority');
}

function requireWallet(wallet: WalletReference | undefined): WalletReference {
  if (!wallet) {
    throw new SwigRouteError('wallet is required');
  }
  return wallet;
}

function readAmount(body: Record<string, unknown>): Amount {
  const amount = readRequiredString(body, 'amount');
  if (!/^[0-9]+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new SwigRouteError('amount must be a positive integer string');
  }
  return amount;
}

function readNetwork(value: unknown): Network | undefined {
  if (value === 'devnet' || value === 'mainnet') {
    return value;
  }
  return undefined;
}

function readRequiredString(
  body: Record<string, unknown>,
  key: string,
): string {
  const value = readOptionalString(body, key);
  if (!value) {
    throw new SwigRouteError(`${key} is required`);
  }
  return value;
}

function readOptionalString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalBoolean(
  body: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = body[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readOptionalNumber(
  body: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = body[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = globalThis.process?.env?.[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}
