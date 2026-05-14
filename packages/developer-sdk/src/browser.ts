import type {
  Amount,
  IdpWalletSession,
  Network,
  PreparedTransaction,
  PreparedTransactionWire,
  WalletReference,
} from './types/index.js';
import {
  normalizeAmount,
  normalizePreparedTransaction,
} from './wallets/normalizers.js';

export interface SwigBrowserClientConfig {
  proxyUrl?: string;
  /**
   * Deprecated. Use proxyUrl to make it clear this points to your app's
   * server-side SDK proxy, not the Swig transaction API.
   */
  baseUrl?: string;
  fetch?: typeof fetch;
  network?: Network;
}

export interface BrowserWalletHandleOptions {
  network?: Network;
  requesterPubkey?: string;
}

export interface BrowserTransferSolArgs {
  destination: string;
  amount: Amount;
  network?: Network;
  idempotencyKey?: string;
}

export interface PrepareSolTransferRequest {
  wallet: WalletReference;
  network: Network;
  destination: string;
  amount: string;
  idempotencyKey?: string;
}

export interface SignedPreparedTransaction {
  intentId: string;
  transaction: string;
  transactionEncoding?: PreparedTransaction['transactionEncoding'];
  network?: Network;
}

export interface PreparedTransactionSigner {
  sign(prepared: PreparedTransaction): Promise<SignedPreparedTransaction>;
}

export interface SignPreparedOptions {
  signer: PreparedTransactionSigner;
}

type PreparedResponseBody =
  | PreparedTransactionWire
  | {
      prepared?: PreparedTransactionWire;
      data?: PreparedTransactionWire;
      error?: string;
    };

const defaultBrowserApiBaseUrl = '/api/swig';

export class SwigBrowserClient {
  readonly wallets: BrowserWalletsClient;
  readonly signing: BrowserSigningClient;

  constructor(config: SwigBrowserClientConfig = {}) {
    const http = new BrowserHttpClient({
      baseUrl: config.proxyUrl ?? config.baseUrl ?? defaultBrowserApiBaseUrl,
      fetch: config.fetch ?? fetch,
    });

    this.wallets = new BrowserWalletsClient(http, config.network);
    this.signing = new BrowserSigningClient();
  }
}

export class BrowserWalletsClient {
  constructor(
    private readonly http: BrowserHttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  use = (
    wallet: string | WalletReference,
    options: BrowserWalletHandleOptions = {},
  ): BrowserWalletHandle => {
    if (typeof wallet === 'string') {
      return new BrowserWalletHandle(this, {
        swigConfigAddress: wallet,
        network: options.network ?? this.defaultNetwork,
        requesterPubkey: options.requesterPubkey,
      });
    }

    return new BrowserWalletHandle(this, {
      swigId: wallet.swigId,
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      network: options.network ?? wallet.network ?? this.defaultNetwork,
      requesterPubkey: options.requesterPubkey ?? wallet.requesterPubkey,
    });
  };

  fromIdpSession = (
    session: IdpWalletSession,
    options: BrowserWalletHandleOptions = {},
  ): BrowserWalletHandle => {
    return new BrowserWalletHandle(this, {
      swigConfigAddress: session.configAddress,
      walletAddress: session.walletAddress,
      requesterPubkey:
        options.requesterPubkey ??
        session.requesterPubkey ??
        session.authorityPublicKey,
      network: options.network ?? this.defaultNetwork,
    });
  };

  prepareSolTransfer = async (
    wallet: BrowserWalletHandle,
    args: BrowserTransferSolArgs,
  ): Promise<PreparedTransaction> => {
    const network = args.network ?? wallet.network ?? this.defaultNetwork;
    if (!network) {
      throw new Error('network is required');
    }

    return this.http.postPrepared('/transfer/sol', {
      wallet: wallet.toReference(),
      network,
      destination: args.destination,
      amount: normalizeAmount(args.amount),
      idempotencyKey: args.idempotencyKey,
    } satisfies PrepareSolTransferRequest);
  };
}

export class BrowserWalletHandle {
  readonly swigId?: string;
  readonly swigConfigAddress: string;
  readonly walletAddress?: string;
  readonly network?: Network;
  readonly requesterPubkey?: string;
  readonly transfer: BrowserWalletTransferClient;

  constructor(wallets: BrowserWalletsClient, init: WalletReference) {
    this.swigId = init.swigId;
    this.swigConfigAddress = init.swigConfigAddress;
    this.walletAddress = init.walletAddress;
    this.network = init.network;
    this.requesterPubkey = init.requesterPubkey;
    this.transfer = new BrowserWalletTransferClient(wallets, this);
  }

  toReference = (): WalletReference => ({
    swigId: this.swigId,
    swigConfigAddress: this.swigConfigAddress,
    walletAddress: this.walletAddress,
    network: this.network,
    requesterPubkey: this.requesterPubkey,
  });
}

export class BrowserWalletTransferClient {
  constructor(
    private readonly wallets: BrowserWalletsClient,
    private readonly wallet: BrowserWalletHandle,
  ) {}

  sol = (args: BrowserTransferSolArgs): Promise<PreparedTransaction> => {
    return this.wallets.prepareSolTransfer(this.wallet, args);
  };

  prepareSol = this.sol;
}

export class BrowserSigningClient {
  signPrepared = async (
    prepared: PreparedTransaction,
    options: SignPreparedOptions,
  ): Promise<SignedPreparedTransaction> => {
    return options.signer.sign(prepared);
  };
}

class BrowserHttpClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(config: { baseUrl: string; fetch: typeof fetch }) {
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#fetch = config.fetch;
  }

  postPrepared = async (
    path: string,
    body: PrepareSolTransferRequest,
  ): Promise<PreparedTransaction> => {
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = (await parseResponseBody(
      response,
    )) as PreparedResponseBody;

    if (!response.ok) {
      throw new Error(
        readResponseError(responseBody) ?? 'Unable to prepare transaction',
      );
    }

    return normalizePreparedTransaction(unwrapPreparedResponse(responseBody));
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function unwrapPreparedResponse(
  body: PreparedResponseBody,
): PreparedTransactionWire {
  if ('prepared' in body && body.prepared) {
    return body.prepared;
  }
  if ('data' in body && body.data) {
    return body.data;
  }
  return body as PreparedTransactionWire;
}

function readResponseError(body: PreparedResponseBody): string | undefined {
  if ('error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return undefined;
}
