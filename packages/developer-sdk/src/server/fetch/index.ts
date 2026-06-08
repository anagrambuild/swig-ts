import type {
  Amount,
  CreateWalletArgs,
  Network,
  PaymasterBalanceKind,
  PrepareArgs,
  PrepareOperation,
  SwapArgs,
  TransferTokenArgs,
  WalletAuthority,
  WalletReference,
} from '../../types/index.js';
import { SwigClient } from '../typescript/index.js';

export type SwigPostProxyRoute =
  | 'wallet/create'
  | 'prepare'
  | 'transfer/sol'
  | 'transfer/spl-token'
  | 'swap/jupiter';

export type SwigReadProxyRoute =
  | 'wallet/balance/usd'
  | 'wallet/token-balances'
  | 'wallet/token-transactions'
  | 'paymaster/balance';

export type SwigProxyRoute = SwigPostProxyRoute | SwigReadProxyRoute;

export interface SwigProxyWalletReference extends WalletReference {
  roleId?: number;
  authorityPublicKey?: string;
}

export interface SwigRouteContext {
  request: Request;
  route: SwigProxyRoute;
  body: Record<string, unknown>;
  wallet?: SwigProxyWalletReference;
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
  resolveRequesterAuthority?: (
    context: SwigRouteContext,
  ) => MaybePromise<WalletAuthority | undefined>;
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

const swigPostProxyRoutes: SwigPostProxyRoute[] = [
  'wallet/create',
  'prepare',
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

export function createSwigGetHandler(
  config: CreateSwigFetchHandlerConfig = {},
): SwigFetchHandler {
  return (request: Request) => handleGet(request, config);
}

async function handlePost(
  request: Request,
  config: CreateSwigFetchHandlerConfig,
): Promise<Response> {
  try {
    const route = resolvePostRoute(request);
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
      case 'prepare':
        return json({
          prepared: await prepareGroupedOperations(swig, body, context, config),
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

async function handleGet(
  request: Request,
  config: CreateSwigFetchHandlerConfig,
): Promise<Response> {
  try {
    const route = resolveReadRoute(request);
    const searchParams = new URL(request.url).searchParams;
    const network = readNetwork(searchParams.get('network')) ?? config.network;
    const paymasterKind = readPaymasterBalanceKind(searchParams.get('kind'));
    const apiKey = resolveApiKey(config);
    const transactionApiUrl = resolveTransactionApiUrl(config);
    const swig = new SwigClient({
      apiKey,
      ...(transactionApiUrl ? { baseUrl: transactionApiUrl } : {}),
      ...(network ? { network } : {}),
      ...(config.fetch ? { fetch: config.fetch } : {}),
    });

    switch (route.route) {
      case 'wallet/balance/usd':
        return json(
          await swig.wallets
            .use(route.swigConfigAddress, walletOptions(network))
            .getUsdBalance(walletOptions(network)),
        );
      case 'wallet/token-balances':
        return json(
          await swig.wallets
            .use(route.swigConfigAddress, walletOptions(network))
            .listTokenBalances(walletOptions(network)),
        );
      case 'wallet/token-transactions': {
        const limit = readOptionalQueryNumber(request, 'limit');
        return json(
          await swig.wallets
            .use(route.swigConfigAddress, walletOptions(network))
            .listTokenTransactions({
              ...walletOptions(network),
              ...(limit === undefined ? {} : { limit }),
            }),
        );
      }
      case 'paymaster/balance':
        return json(
          await swig.paymaster.getBalance(
            paymasterOptions(network, paymasterKind),
          ),
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to fetch Swig resource';
    const status = error instanceof SwigRouteError ? error.status : 400;
    return json({ error: message }, status);
  }
}

function walletOptions(network: Network | undefined): { network?: Network } {
  return network ? { network } : {};
}

function paymasterOptions(
  network: Network | undefined,
  kind: PaymasterBalanceKind | undefined,
) {
  return {
    ...(network ? { network } : {}),
    ...(kind ? { kind } : {}),
  };
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
  const recovery = readRecoveryOptions(body.recovery);
  if (!policyId && !initialUser) {
    throw new SwigRouteError('policyId or initialUser is required');
  }

  const args: CreateWalletArgs = {
    feePayer,
    ...(policyId ? { policyId } : {}),
    ...(initialUser ? { initialUser } : {}),
    ...(recovery ? { recovery } : {}),
    ...(context.network ? { network: context.network } : {}),
    ...(readOptionalString(body, 'idempotencyKey')
      ? { idempotencyKey: readOptionalString(body, 'idempotencyKey') }
      : {}),
  };
  const created = await swig.wallets.create(args);

  if (created.transactions.length === 0) {
    throw new SwigRouteError(
      'Wallet creation response is missing transaction',
      502,
    );
  }

  return createWalletResult(created);
}

async function prepareGroupedOperations(
  swig: SwigClient,
  body: Record<string, unknown>,
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
) {
  const wallet = requireWallet(context.wallet);
  const requesterAuthority = await resolveRequesterAuthority(context, config);
  const feePayer = await resolveFeePayer(context, config);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterAuthority,
    },
    { network: context.network },
  );
  const args: PrepareArgs = {
    feePayer,
    requesterAuthority,
    operations: readPrepareOperations(body.operations),
    ...(context.network ? { network: context.network } : {}),
    ...(readOptionalString(body, 'idempotencyKey')
      ? { idempotencyKey: readOptionalString(body, 'idempotencyKey') }
      : {}),
  };

  return handle.prepare(args);
}

function createWalletResult(
  wallet: Awaited<ReturnType<SwigClient['wallets']['create']>>,
) {
  return {
    wallet: wallet.wallet,
    transactions: wallet.transactions,
    clientAuthorityTransactions: wallet.clientAuthorityTransactions,
    operatorSignedTransactions: wallet.operatorSignedTransactions,
    feePayerOnlyTransactions: wallet.feePayerOnlyTransactions,
    creationTransaction: wallet.creationTransaction,
    addAuthorityTransaction: wallet.addAuthorityTransaction,
    configureRecoveryTransaction: wallet.configureRecoveryTransaction,
    recoverySetup: wallet.recoverySetup,
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
  const requesterAuthority = await resolveRequesterAuthority(context, config);
  const feePayer = await resolveFeePayer(context, config);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterAuthority,
    },
    { network: context.network },
  );

  return handle.transfer({
    feePayer,
    requesterAuthority,
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
  const requesterAuthority = await resolveRequesterAuthority(context, config);
  const feePayer = await resolveFeePayer(context, config);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterAuthority,
    },
    { network: context.network },
  );
  const args: TransferTokenArgs = {
    feePayer,
    requesterAuthority,
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
  const requesterAuthority = await resolveRequesterAuthority(context, config);
  const feePayer = await resolveFeePayer(context, config);
  const handle = swig.wallets.use(
    {
      ...wallet,
      requesterAuthority,
    },
    { network: context.network },
  );
  const args: SwapArgs = {
    feePayer,
    requesterAuthority,
    inputMint: readRequiredString(body, 'inputMint'),
    outputMint: readRequiredString(body, 'outputMint'),
    amount: readAmount(body),
    ...(readOptionalNumber(body, 'slippageBps') !== undefined
      ? { slippageBps: readOptionalNumber(body, 'slippageBps') }
      : {}),
    ...(readOptionalString(body, 'destinationAccount')
      ? {
          destinationAccount: readOptionalString(body, 'destinationAccount'),
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

async function resolveRequesterAuthority(
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
): Promise<WalletAuthority> {
  const requesterAuthority =
    context.wallet?.requesterAuthority ??
    readWalletAuthority(
      context.body.requesterAuthority,
      'requesterAuthority',
    ) ??
    (await config.resolveRequesterAuthority?.(context));

  if (!requesterAuthority) {
    throw new SwigRouteError('requesterAuthority is required');
  }

  return requesterAuthority;
}

async function resolveFeePayer(
  context: SwigRouteContext,
  config: CreateSwigFetchHandlerConfig,
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
    );

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

function resolvePostRoute(request: Request): SwigPostProxyRoute {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '');
  const route = swigPostProxyRoutes.find(
    (candidate) =>
      pathname === `/${candidate}` || pathname.endsWith(`/${candidate}`),
  );

  if (!route) {
    throw new SwigRouteError('Unsupported Swig route', 404);
  }

  return route;
}

function resolveReadRoute(
  request: Request,
):
  | { route: 'wallet/balance/usd'; swigConfigAddress: string }
  | { route: 'wallet/token-balances'; swigConfigAddress: string }
  | { route: 'wallet/token-transactions'; swigConfigAddress: string }
  | { route: 'paymaster/balance' } {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '');
  if (
    pathname === '/paymaster/balance' ||
    pathname.endsWith('/paymaster/balance')
  ) {
    return { route: 'paymaster/balance' };
  }

  const match = pathname.match(
    /\/wallet\/([^/]+)\/(balance\/usd|token-balances|token-transactions)$/,
  );
  if (!match) {
    throw new SwigRouteError('Unsupported Swig route', 404);
  }

  const swigConfigAddress = decodeURIComponent(match[1] ?? '');
  if (!swigConfigAddress) {
    throw new SwigRouteError('swigConfigAddress is required');
  }

  switch (match[2]) {
    case 'balance/usd':
      return { route: 'wallet/balance/usd', swigConfigAddress };
    case 'token-balances':
      return { route: 'wallet/token-balances', swigConfigAddress };
    case 'token-transactions':
      return { route: 'wallet/token-transactions', swigConfigAddress };
    default:
      throw new SwigRouteError('Unsupported Swig route', 404);
  }
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

function readWallet(value: unknown): SwigProxyWalletReference | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new SwigRouteError('wallet must be an object');
  }

  return {
    swigConfigAddress: readRequiredString(value, 'swigConfigAddress'),
    walletAddress: readOptionalString(value, 'walletAddress'),
    roleId: readOptionalNumber(value, 'roleId'),
    authorityPublicKey: readOptionalString(value, 'authorityPublicKey'),
    requesterAuthority: readWalletAuthority(
      value.requesterAuthority,
      'wallet.requesterAuthority',
    ),
    network: readNetwork(value.network),
  };
}

function readWalletAuthority(
  value: unknown,
  field = 'initialUser',
): WalletAuthority | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new SwigRouteError(`${field} must be an object`);
  }
  for (const scheme of ['ed25519', 'secp256k1', 'secp256r1'] as const) {
    const authority = value[scheme];
    if (!isRecord(authority)) {
      continue;
    }
    const publicKey = readOptionalString(authority, 'publicKey');
    if (publicKey) {
      return { [scheme]: { publicKey } } as WalletAuthority;
    }
  }
  if (isRecord(value.programExecProof)) {
    const roleId = readOptionalNumber(value.programExecProof, 'roleId');
    const zkProof = readOptionalString(value.programExecProof, 'zkProof');
    if (roleId !== undefined && zkProof) {
      return { programExecProof: { roleId, zkProof } };
    }
  }
  throw new SwigRouteError(`${field} must include a supported authority`);
}

function readRecoveryOptions(
  value: unknown,
): CreateWalletArgs['recovery'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new SwigRouteError('recovery must be an object');
  }

  const guardianPubkey = readOptionalString(value, 'guardianPubkey');
  const delaySeconds = readOptionalNumber(value, 'delaySeconds');
  const targetRoleId = readOptionalNumber(value, 'targetRoleId');

  return {
    ...(guardianPubkey ? { guardianPubkey } : {}),
    ...(delaySeconds !== undefined ? { delaySeconds } : {}),
    ...(targetRoleId !== undefined ? { targetRoleId } : {}),
  };
}

function requireWallet(wallet: WalletReference | undefined): WalletReference {
  if (!wallet) {
    throw new SwigRouteError('wallet is required');
  }
  return wallet;
}

function readPrepareOperations(value: unknown): PrepareOperation[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new SwigRouteError('operations must be a non-empty array');
  }

  return value.map((operation, index) => {
    if (!isRecord(operation)) {
      throw new SwigRouteError(`operations[${index}] must be an object`);
    }

    switch (operation.type) {
      case 'transferSol':
        return {
          type: 'transferSol',
          destination: readRequiredString(operation, 'destination'),
          amount: readAmount(operation),
        };
      case 'transferToken':
        return {
          type: 'transferToken',
          mint: readRequiredString(operation, 'mint'),
          destinationOwner: readRequiredString(operation, 'destinationOwner'),
          amount: readAmount(operation),
        };
      default:
        throw new SwigRouteError(
          `operations[${index}].type must be transferSol or transferToken`,
        );
    }
  });
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

function readPaymasterBalanceKind(
  value: string | null,
): PaymasterBalanceKind | undefined {
  switch (value?.trim().toUpperCase()) {
    case undefined:
    case '':
      return undefined;
    case 'API':
    case 'PAYMASTER_KIND_API':
      return 'api';
    case 'IDP':
    case 'PAYMASTER_KIND_IDP':
      return 'idp';
    default:
      throw new SwigRouteError('kind must be api or idp');
  }
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

function readOptionalQueryNumber(
  request: Request,
  key: string,
): number | undefined {
  const value = new URL(request.url).searchParams.get(key);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
