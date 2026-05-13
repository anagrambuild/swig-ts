import type {
  Amount,
  IdpWalletSession,
  Network,
  PreparedTransaction,
  PreparedTransactionWire,
} from './types/index.js';
import {
  normalizeAmount,
  normalizePreparedTransaction,
} from './wallets/normalizers.js';

export interface SwigBrowserClientConfig {
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
}

export interface PrepareSolTransferRequest {
  session: IdpWalletSession;
  network: Network;
  destination: string;
  amountLamports: string;
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
      baseUrl: config.baseUrl ?? defaultBrowserApiBaseUrl,
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

  fromIdpSession = (
    session: IdpWalletSession,
    options: BrowserWalletHandleOptions = {},
  ): BrowserWalletHandle => {
    return new BrowserWalletHandle(this, {
      session: {
        ...session,
        requesterPubkey: options.requesterPubkey ?? session.requesterPubkey,
      },
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

    return this.http.postPrepared('/transfers/prepare', {
      session: wallet.session,
      network,
      destination: args.destination,
      amountLamports: normalizeAmount(args.amount),
    } satisfies PrepareSolTransferRequest);
  };
}

export class BrowserWalletHandle {
  readonly session: IdpWalletSession;
  readonly network?: Network;
  readonly transfer: BrowserWalletTransferClient;

  constructor(
    wallets: BrowserWalletsClient,
    init: { session: IdpWalletSession; network?: Network },
  ) {
    this.session = init.session;
    this.network = init.network;
    this.transfer = new BrowserWalletTransferClient(wallets, this);
  }
}

export class BrowserWalletTransferClient {
  constructor(
    private readonly wallets: BrowserWalletsClient,
    private readonly wallet: BrowserWalletHandle,
  ) {}

  prepareSol = (args: BrowserTransferSolArgs): Promise<PreparedTransaction> => {
    return this.wallets.prepareSolTransfer(this.wallet, args);
  };
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
