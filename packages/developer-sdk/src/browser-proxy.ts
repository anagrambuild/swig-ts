import {
  normalizeCreateRampSessionResult,
  normalizeGetRampTransactionResult,
  normalizeListRampTransactionsResult,
  normalizeQuoteRampResult,
  normalizeRampOptions,
} from './ramp/client.js';
import type {
  CreateRampSessionArgs,
  CreateRampSessionResult,
  CreateRampSessionResultWire,
  GetPaymasterBalanceArgs,
  GetRampOptionsArgs,
  GetRampOptionsResult,
  GetRampOptionsResultWire,
  GetRampTransactionArgs,
  GetRampTransactionResult,
  GetRampTransactionResultWire,
  IdpWalletSession,
  ListRampTransactionsArgs,
  ListRampTransactionsResult,
  ListRampTransactionsResultWire,
  ListSwigTokenBalancesResult,
  ListSwigTokenTransactionsArgs,
  ListSwigTokenTransactionsResult,
  Network,
  PaymasterBalance,
  PrepareArgs,
  PreparedTransaction,
  PreparedTransactionsResult,
  PreparedTransactionWire,
  PrepareOperation,
  PrepareTransactionsResponseWire,
  QuoteRampArgs,
  QuoteRampResult,
  QuoteRampResultWire,
  SwapArgs,
  SwigUsdBalance,
  TransferSolArgs,
  TransferTokenArgs,
  WalletAuthority,
  WalletHandleOptions,
  WalletReadArgs,
  WalletReference,
} from './types/index.js';
import {
  normalizeAmount,
  normalizePreparedTransaction,
  normalizePrepareTransactionsResponse,
} from './wallets/normalizers.js';

export interface SwigBrowserClientConfig {
  /**
   * Local app proxy base path. Defaults to the route created by the Next.js
   * adapter: /api/swig.
   */
  basePath?: string;
  network?: Network;
  fetch?: typeof fetch;
}

export interface BrowserWalletReference extends WalletReference {
  roleId?: number;
  authorityPublicKey?: string;
}

export type BrowserTransferSolArgs = WithoutFeePayer<TransferSolArgs>;
export type BrowserTransferTokenArgs = WithoutFeePayer<TransferTokenArgs>;
export type BrowserTransferArgs =
  | BrowserTransferSolArgs
  | BrowserTransferTokenArgs;
export type BrowserPrepareArgs = WithoutFeePayer<PrepareArgs>;
export type BrowserSwapArgs = WithoutFeePayer<SwapArgs>;

export type BrowserWalletTransferClient = {
  (args: BrowserTransferArgs): Promise<PreparedTransaction>;
  sol(args: BrowserTransferSolArgs): Promise<PreparedTransaction>;
  token(args: BrowserTransferTokenArgs): Promise<PreparedTransaction>;
  splToken(args: BrowserTransferTokenArgs): Promise<PreparedTransaction>;
};

export type BrowserWalletSwapClient = {
  (args: BrowserSwapArgs): Promise<PreparedTransaction>;
  jupiter(args: BrowserSwapArgs): Promise<PreparedTransaction>;
};

type WithoutFeePayer<TArgs extends { feePayer: string }> = Omit<
  TArgs,
  'feePayer'
> & {
  feePayer?: string;
};

type SwigBrowserProxyRoute =
  | 'prepare'
  | 'transfer/sol'
  | 'transfer/spl-token'
  | 'swap/jupiter';

type BrowserProxyRequestArgs = {
  feePayer?: string;
  requesterAuthority?: WalletAuthority;
  network?: Network;
  idempotencyKey?: string;
};

export class SwigBrowserProxyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'SwigBrowserProxyError';
  }
}

export class SwigBrowserClient {
  readonly paymaster: BrowserPaymasterClient;
  readonly ramp: BrowserRampClient;
  readonly wallets: BrowserWalletsClient;

  constructor(config: SwigBrowserClientConfig = {}) {
    this.paymaster = new BrowserPaymasterClient(config);
    this.ramp = new BrowserRampClient(config);
    this.wallets = new BrowserWalletsClient(config);
  }
}

export class BrowserWalletsClient {
  private readonly http: BrowserProxyHttpClient;
  private readonly defaultNetwork?: Network;

  constructor(config: SwigBrowserClientConfig = {}) {
    this.http = new BrowserProxyHttpClient({
      basePath: config.basePath ?? '/api/swig',
      fetch: resolveFetch(config.fetch),
    });
    this.defaultNetwork = config.network;
  }

  use = (
    wallet: string | BrowserWalletReference,
    options: WalletHandleOptions = {},
  ): BrowserWalletHandle => {
    if (typeof wallet === 'string') {
      return new BrowserWalletHandle(this, {
        swigConfigAddress: wallet,
        network: options.network ?? this.defaultNetwork,
        requesterAuthority: options.requesterAuthority,
      });
    }

    return new BrowserWalletHandle(this, {
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      roleId: wallet.roleId,
      authorityPublicKey: wallet.authorityPublicKey,
      network: options.network ?? wallet.network ?? this.defaultNetwork,
      requesterAuthority:
        options.requesterAuthority ?? wallet.requesterAuthority,
    });
  };

  fromIdpSession = (
    session: IdpWalletSession,
    options: WalletHandleOptions = {},
  ): BrowserWalletHandle => {
    return new BrowserWalletHandle(this, {
      swigConfigAddress: session.configAddress,
      walletAddress: session.walletAddress,
      roleId: session.roleId,
      authorityPublicKey: session.authorityPublicKey,
      network: options.network ?? this.defaultNetwork,
      requesterAuthority:
        options.requesterAuthority ?? session.requesterAuthority,
    });
  };

  transfer = (
    wallet: BrowserWalletHandle,
    args: BrowserTransferArgs,
  ): Promise<PreparedTransaction> => {
    return isBrowserTokenTransfer(args)
      ? this.transferToken(wallet, args)
      : this.transferSol(wallet, args);
  };

  prepare = async (
    wallet: BrowserWalletHandle,
    args: BrowserPrepareArgs,
  ): Promise<PreparedTransactionsResult> => {
    const response = await this.http.post<PrepareTransactionsResponseWire>(
      'prepare',
      {
        ...baseRequest(wallet, args, this.defaultNetwork),
        operations: args.operations.map(prepareOperationRequest),
      },
    );
    return normalizePrepareTransactionsResponse(response);
  };

  transferSol = async (
    wallet: BrowserWalletHandle,
    args: BrowserTransferSolArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      'transfer/sol',
      {
        ...baseRequest(wallet, args, this.defaultNetwork),
        destination: args.destination,
        amount: normalizeAmount(args.amount),
      },
    );
    return normalizePreparedTransaction(response);
  };

  transferToken = async (
    wallet: BrowserWalletHandle,
    args: BrowserTransferTokenArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      'transfer/spl-token',
      {
        ...baseRequest(wallet, args, this.defaultNetwork),
        mint: args.mint,
        destinationOwner: args.destinationOwner,
        amount: normalizeAmount(args.amount),
      },
    );
    return normalizePreparedTransaction(response);
  };

  swap = (
    wallet: BrowserWalletHandle,
    args: BrowserSwapArgs,
  ): Promise<PreparedTransaction> => {
    return this.jupiterSwap(wallet, args);
  };

  jupiterSwap = async (
    wallet: BrowserWalletHandle,
    args: BrowserSwapArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      'swap/jupiter',
      {
        ...baseRequest(wallet, args, this.defaultNetwork),
        inputMint: args.inputMint,
        outputMint: args.outputMint,
        amount: normalizeAmount(args.amount),
        slippageBps: args.slippageBps,
        destinationAccount: args.destinationAccount,
        wrapAndUnwrapSol: args.wrapAndUnwrapSol,
        tipAmountLamports:
          args.tipAmountLamports === undefined
            ? undefined
            : normalizeAmount(args.tipAmountLamports),
        computeUnitPricePercentile: args.computeUnitPricePercentile,
        maxAccounts: args.maxAccounts,
        mode: args.mode,
        blockhashSlotsToExpiry: args.blockhashSlotsToExpiry,
      },
    );
    return normalizePreparedTransaction(response);
  };

  getUsdBalance = (
    wallet: BrowserWalletHandle,
    args: WalletReadArgs = {},
  ): Promise<SwigUsdBalance> => {
    return this.http.get<SwigUsdBalance>(
      walletReadRoute(wallet, 'balance/usd'),
      { network: args.network ?? wallet.network ?? this.defaultNetwork },
    );
  };

  listTokenBalances = (
    wallet: BrowserWalletHandle,
    args: WalletReadArgs = {},
  ): Promise<ListSwigTokenBalancesResult> => {
    return this.http.get<ListSwigTokenBalancesResult>(
      walletReadRoute(wallet, 'token-balances'),
      { network: args.network ?? wallet.network ?? this.defaultNetwork },
    );
  };

  listTokenTransactions = (
    wallet: BrowserWalletHandle,
    args: ListSwigTokenTransactionsArgs = {},
  ): Promise<ListSwigTokenTransactionsResult> => {
    return this.http.get<ListSwigTokenTransactionsResult>(
      walletReadRoute(wallet, 'token-transactions'),
      {
        network: args.network ?? wallet.network ?? this.defaultNetwork,
        limit: args.limit,
      },
    );
  };
}

export class BrowserPaymasterClient {
  private readonly http: BrowserProxyHttpClient;
  private readonly defaultNetwork?: Network;

  constructor(config: SwigBrowserClientConfig = {}) {
    this.http = new BrowserProxyHttpClient({
      basePath: config.basePath ?? '/api/swig',
      fetch: resolveFetch(config.fetch),
    });
    this.defaultNetwork = config.network;
  }

  getBalance = (
    args: GetPaymasterBalanceArgs = {},
  ): Promise<PaymasterBalance> => {
    return this.http.get<PaymasterBalance>('paymaster/balance', {
      network: args.network ?? this.defaultNetwork,
      kind: args.kind ? paymasterKindQueryValue(args.kind) : undefined,
    });
  };

  getIdpBalance = (
    args: Omit<GetPaymasterBalanceArgs, 'kind'> = {},
  ): Promise<PaymasterBalance> => {
    return this.getBalance({ ...args, kind: 'idp' });
  };
}

function paymasterKindQueryValue(
  kind: NonNullable<GetPaymasterBalanceArgs['kind']>,
): string {
  switch (kind) {
    case 'api':
      return 'PAYMASTER_KIND_API';
    case 'idp':
      return 'PAYMASTER_KIND_IDP';
  }
}

export class BrowserRampClient {
  private readonly http: BrowserProxyHttpClient;
  private readonly defaultNetwork?: Network;

  constructor(config: SwigBrowserClientConfig = {}) {
    this.http = new BrowserProxyHttpClient({
      basePath: config.basePath ?? '/api/swig',
      fetch: resolveFetch(config.fetch),
    });
    this.defaultNetwork = config.network;
  }

  getOptions = async (
    args: GetRampOptionsArgs,
  ): Promise<GetRampOptionsResult> => {
    const response = await this.http.get<GetRampOptionsResultWire>(
      'ramp/options',
      {
        partnerApplicationId: args.partnerApplicationId,
        countryCode: args.countryCode,
        fiatCurrencyCode: args.fiatCurrencyCode,
      },
    );
    return normalizeRampOptions(response);
  };

  quote = async (args: QuoteRampArgs): Promise<QuoteRampResult> => {
    const response = await this.http.postResource<QuoteRampResultWire>(
      'ramp/quote',
      args,
    );
    return normalizeQuoteRampResult(response);
  };

  createSession = async (
    args: CreateRampSessionArgs,
  ): Promise<CreateRampSessionResult> => {
    const response = await this.http.postResource<CreateRampSessionResultWire>(
      'ramp/sessions',
      args,
    );
    return normalizeCreateRampSessionResult(response);
  };

  getTransaction = async (
    args: GetRampTransactionArgs,
  ): Promise<GetRampTransactionResult> => {
    const response = await this.http.get<GetRampTransactionResultWire>(
      `ramp/transactions/${encodeURIComponent(args.transactionId)}`,
    );
    return normalizeGetRampTransactionResult(response);
  };

  listTransactions = async (
    args: ListRampTransactionsArgs,
  ): Promise<ListRampTransactionsResult> => {
    const response = await this.http.get<ListRampTransactionsResultWire>(
      `ramp/wallets/${encodeURIComponent(args.walletId)}/transactions`,
      {
        network: args.network ?? this.defaultNetwork,
        direction: args.direction,
        status: args.status,
        limit: args.limit,
      },
    );
    return normalizeListRampTransactionsResult(response);
  };
}

class BrowserProxyHttpClient {
  readonly #basePath: string;
  readonly #fetch: typeof fetch;

  constructor(config: { basePath: string; fetch: typeof fetch }) {
    this.#basePath = config.basePath.replace(/\/$/, '');
    this.#fetch = config.fetch;
  }

  post = async <TResponse>(
    route: SwigBrowserProxyRoute,
    body: unknown,
  ): Promise<TResponse> => {
    const response = await this.#fetch(`${this.#basePath}/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new SwigBrowserProxyError(
        errorMessageFromBody(responseBody),
        response.status,
        responseBody,
      );
    }

    return readPrepared<TResponse>(responseBody);
  };

  postResource = async <TResponse>(
    route: string,
    body: unknown,
  ): Promise<TResponse> => {
    const response = await this.#fetch(`${this.#basePath}/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new SwigBrowserProxyError(
        errorMessageFromBody(responseBody),
        response.status,
        responseBody,
      );
    }

    return responseBody as TResponse;
  };

  get = async <TResponse>(
    route: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<TResponse> => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const response = await this.#fetch(`${this.#basePath}/${route}${suffix}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new SwigBrowserProxyError(
        errorMessageFromBody(responseBody),
        response.status,
        responseBody,
      );
    }

    return responseBody as TResponse;
  };
}

export class BrowserWalletHandle {
  readonly swigConfigAddress: string;
  readonly walletAddress?: string;
  readonly roleId?: number;
  readonly authorityPublicKey?: string;
  readonly network?: Network;
  readonly requesterAuthority?: WalletAuthority;
  readonly transfer: BrowserWalletTransferClient;
  readonly swap: BrowserWalletSwapClient;

  constructor(
    private readonly wallets: BrowserWalletsClient,
    init: BrowserWalletReference,
  ) {
    this.swigConfigAddress = init.swigConfigAddress;
    this.walletAddress = init.walletAddress;
    this.roleId = init.roleId;
    this.authorityPublicKey = init.authorityPublicKey;
    this.network = init.network;
    this.requesterAuthority = init.requesterAuthority;
    this.transfer = createBrowserWalletTransferClient(wallets, this);
    this.swap = createBrowserWalletSwapClient(wallets, this);
  }

  prepare = (args: BrowserPrepareArgs): Promise<PreparedTransactionsResult> =>
    this.wallets.prepare(this, args);

  getUsdBalance = (args?: WalletReadArgs): Promise<SwigUsdBalance> =>
    this.wallets.getUsdBalance(this, args);

  listTokenBalances = (
    args?: WalletReadArgs,
  ): Promise<ListSwigTokenBalancesResult> =>
    this.wallets.listTokenBalances(this, args);

  listTokenTransactions = (
    args?: ListSwigTokenTransactionsArgs,
  ): Promise<ListSwigTokenTransactionsResult> =>
    this.wallets.listTokenTransactions(this, args);
}

function walletReadRoute(
  wallet: BrowserWalletHandle,
  route: 'balance/usd' | 'token-balances' | 'token-transactions',
): string {
  return `wallet/${encodeURIComponent(wallet.swigConfigAddress)}/${route}`;
}

function createBrowserWalletTransferClient(
  wallets: BrowserWalletsClient,
  wallet: BrowserWalletHandle,
): BrowserWalletTransferClient {
  const transfer = ((args: BrowserTransferArgs) =>
    wallets.transfer(wallet, args)) as BrowserWalletTransferClient;

  transfer.sol = (args: BrowserTransferSolArgs) =>
    wallets.transferSol(wallet, args);
  transfer.token = (args: BrowserTransferTokenArgs) =>
    wallets.transferToken(wallet, args);
  transfer.splToken = transfer.token;

  return transfer;
}

function createBrowserWalletSwapClient(
  wallets: BrowserWalletsClient,
  wallet: BrowserWalletHandle,
): BrowserWalletSwapClient {
  const swap = ((args: BrowserSwapArgs) =>
    wallets.swap(wallet, args)) as BrowserWalletSwapClient;
  swap.jupiter = (args: BrowserSwapArgs) => wallets.jupiterSwap(wallet, args);

  return swap;
}

function baseRequest(
  wallet: BrowserWalletHandle,
  args: BrowserProxyRequestArgs,
  defaultNetwork?: Network,
) {
  const network = args.network ?? wallet.network ?? defaultNetwork;
  const requesterAuthority =
    args.requesterAuthority ?? wallet.requesterAuthority;

  return {
    wallet: {
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      roleId: wallet.roleId,
      authorityPublicKey: wallet.authorityPublicKey,
      network,
      requesterAuthority,
    },
    network,
    requesterAuthority,
    feePayer: args.feePayer,
    idempotencyKey: args.idempotencyKey,
  };
}

function prepareOperationRequest(
  operation: PrepareOperation,
): PrepareOperation {
  switch (operation.type) {
    case 'transferSol':
      return {
        type: 'transferSol',
        destination: operation.destination,
        amount: normalizeAmount(operation.amount),
      };
    case 'transferToken':
      return {
        type: 'transferToken',
        mint: operation.mint,
        destinationOwner: operation.destinationOwner,
        amount: normalizeAmount(operation.amount),
      };
  }
}

function isBrowserTokenTransfer(
  args: BrowserTransferArgs,
): args is BrowserTransferTokenArgs {
  return (
    'mint' in args && typeof args.mint === 'string' && args.mint.length > 0
  );
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (!resolvedFetch) {
    throw new Error('fetch is required to use SwigBrowserClient');
  }
  return resolvedFetch;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readPrepared<TResponse>(body: unknown): TResponse {
  if (isRecord(body) && 'prepared' in body) {
    return body.prepared as TResponse;
  }
  throw new Error('Swig proxy response is missing prepared');
}

function errorMessageFromBody(body: unknown): string {
  if (isRecord(body) && typeof body.error === 'string' && body.error.trim()) {
    return body.error;
  }
  return 'Swig proxy request failed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
