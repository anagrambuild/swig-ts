import type {
  IdpWalletSession,
  Network,
  PrepareArgs,
  PreparedTransaction,
  PreparedTransactionsResult,
  PreparedTransactionWire,
  PrepareOperation,
  PrepareTransactionsResponseWire,
  SwapArgs,
  TransferSolArgs,
  TransferTokenArgs,
  WalletAuthority,
  WalletHandleOptions,
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
  readonly wallets: BrowserWalletsClient;

  constructor(config: SwigBrowserClientConfig = {}) {
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
