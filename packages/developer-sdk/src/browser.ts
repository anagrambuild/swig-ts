import type {
  AddAuthorityChallenge,
  Amount,
  CreateWalletArgs,
  CreateWalletResponseWire,
  IdpWalletSession,
  Network,
  PreparedTransaction,
  PreparedTransactionWire,
  SwapArgs,
  TransferTokenArgs,
  WalletAuthority,
  WalletReference,
} from './types/index.js';
import {
  normalizeAmount,
  normalizeCreateWalletResponse,
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

export interface BrowserCreateWalletArgs extends Omit<
  CreateWalletArgs,
  'feePayer'
> {
  feePayer?: string;
}

export interface BrowserTransferTokenArgs extends Pick<
  TransferTokenArgs,
  'mint' | 'destinationOwner' | 'amount'
> {
  network?: Network;
  idempotencyKey?: string;
}

export type BrowserSwapJupiterArgs = Omit<
  SwapArgs,
  'feePayer' | 'requesterPubkey'
>;

export interface BrowserCreateWalletRequest {
  network: Network;
  policyId?: string;
  initialUser?: WalletAuthority;
  guardianPubkey?: string;
  feePayer?: string;
  idempotencyKey?: string;
}

export interface PrepareSolTransferRequest {
  wallet: WalletReference;
  network: Network;
  destination: string;
  amount: string;
  idempotencyKey?: string;
}

export interface PrepareTokenTransferRequest {
  wallet: WalletReference;
  network: Network;
  mint: string;
  destinationOwner: string;
  amount: string;
  idempotencyKey?: string;
}

export interface PrepareJupiterSwapRequest {
  wallet: WalletReference;
  network: Network;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  destinationTokenAccount?: string;
  nativeDestinationAccount?: string;
  wrapAndUnwrapSol?: boolean;
  tipAmountLamports?: string;
  computeUnitPricePercentile?: string;
  maxAccounts?: number;
  mode?: string;
  blockhashSlotsToExpiry?: number;
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
type CreateWalletResponseBody =
  | CreateWalletResponseWire
  | {
      prepared?: CreateWalletResponseWire;
      data?: CreateWalletResponseWire;
      error?: string;
    };

type PreparedRequestBody =
  | PrepareSolTransferRequest
  | PrepareTokenTransferRequest
  | PrepareJupiterSwapRequest;

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

  create = async (
    args: BrowserCreateWalletArgs,
  ): Promise<BrowserWalletHandle> => {
    const network = resolveNetwork(args.network, this.defaultNetwork);
    const created = await this.http.postCreateWallet('/wallet/create', {
      network,
      policyId: args.policyId,
      initialUser: args.initialUser,
      guardianPubkey: args.guardianPubkey,
      feePayer: args.feePayer,
      idempotencyKey: args.idempotencyKey,
    } satisfies BrowserCreateWalletRequest);

    return new BrowserWalletHandle(this, {
      ...created.wallet,
      network: created.network ?? network,
      creationTransaction: created.creationTransaction,
      creationTransactions: created.transactions,
      addAuthorityChallenge: created.addAuthorityChallenge,
    });
  };

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
    const network = resolveNetwork(
      args.network,
      wallet.network,
      this.defaultNetwork,
    );

    return this.http.postPrepared('/transfer/sol', {
      wallet: wallet.toReference(),
      network,
      destination: args.destination,
      amount: normalizeAmount(args.amount),
      idempotencyKey: args.idempotencyKey,
    } satisfies PrepareSolTransferRequest);
  };

  prepareTokenTransfer = async (
    wallet: BrowserWalletHandle,
    args: BrowserTransferTokenArgs,
  ): Promise<PreparedTransaction> => {
    const network = resolveNetwork(
      args.network,
      wallet.network,
      this.defaultNetwork,
    );

    return this.http.postPrepared('/transfer/spl-token', {
      wallet: wallet.toReference(),
      network,
      mint: args.mint,
      destinationOwner: args.destinationOwner,
      amount: normalizeAmount(args.amount),
      idempotencyKey: args.idempotencyKey,
    } satisfies PrepareTokenTransferRequest);
  };

  prepareJupiterSwap = async (
    wallet: BrowserWalletHandle,
    args: BrowserSwapJupiterArgs,
  ): Promise<PreparedTransaction> => {
    const network = resolveNetwork(
      args.network,
      wallet.network,
      this.defaultNetwork,
    );

    return this.http.postPrepared('/swap/jupiter', {
      wallet: wallet.toReference(),
      network,
      inputMint: args.inputMint,
      outputMint: args.outputMint,
      amount: normalizeAmount(args.amount),
      slippageBps: args.slippageBps,
      destinationTokenAccount: args.destinationTokenAccount,
      nativeDestinationAccount: args.nativeDestinationAccount,
      wrapAndUnwrapSol: args.wrapAndUnwrapSol,
      tipAmountLamports:
        args.tipAmountLamports === undefined
          ? undefined
          : normalizeAmount(args.tipAmountLamports),
      computeUnitPricePercentile: args.computeUnitPricePercentile,
      maxAccounts: args.maxAccounts,
      mode: args.mode,
      blockhashSlotsToExpiry: args.blockhashSlotsToExpiry,
      idempotencyKey: args.idempotencyKey,
    } satisfies PrepareJupiterSwapRequest);
  };
}

export class BrowserWalletHandle {
  readonly swigId?: string;
  readonly swigConfigAddress: string;
  readonly walletAddress?: string;
  readonly network?: Network;
  readonly requesterPubkey?: string;
  readonly creationTransaction?: PreparedTransaction;
  readonly creationTransactions: PreparedTransaction[];
  readonly addAuthorityChallenge?: AddAuthorityChallenge;
  readonly transfer: BrowserWalletTransferClient;
  readonly swap: BrowserWalletSwapClient;

  constructor(wallets: BrowserWalletsClient, init: BrowserWalletHandleInit) {
    this.swigId = init.swigId;
    this.swigConfigAddress = init.swigConfigAddress;
    this.walletAddress = init.walletAddress;
    this.network = init.network;
    this.requesterPubkey = init.requesterPubkey;
    this.creationTransaction = init.creationTransaction;
    this.creationTransactions =
      init.creationTransactions ??
      (init.creationTransaction ? [init.creationTransaction] : []);
    this.addAuthorityChallenge = init.addAuthorityChallenge;
    this.transfer = new BrowserWalletTransferClient(wallets, this);
    this.swap = new BrowserWalletSwapClient(wallets, this);
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

  token = (args: BrowserTransferTokenArgs): Promise<PreparedTransaction> => {
    return this.wallets.prepareTokenTransfer(this.wallet, args);
  };

  splToken = this.token;

  prepareSol = this.sol;
}

export class BrowserWalletSwapClient {
  constructor(
    private readonly wallets: BrowserWalletsClient,
    private readonly wallet: BrowserWalletHandle,
  ) {}

  jupiter = (args: BrowserSwapJupiterArgs): Promise<PreparedTransaction> => {
    return this.wallets.prepareJupiterSwap(this.wallet, args);
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
    body: PreparedRequestBody,
  ): Promise<PreparedTransaction> => {
    return normalizePreparedTransaction(
      unwrapPreparedResponse(
        await this.postJson<PreparedResponseBody>(path, body),
      ),
    );
  };

  postCreateWallet = async (
    path: string,
    body: BrowserCreateWalletRequest,
  ): Promise<ReturnType<typeof normalizeCreateWalletResponse>> => {
    return normalizeCreateWalletResponse(
      unwrapCreateWalletResponse(
        await this.postJson<CreateWalletResponseBody>(path, body),
      ),
    );
  };

  private postJson = async <TBody>(
    path: string,
    body: object,
  ): Promise<TBody> => {
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = (await parseResponseBody(response)) as TBody;

    if (!response.ok) {
      throw new Error(
        readResponseError(responseBody) ?? 'Unable to prepare Swig request',
      );
    }

    return responseBody;
  };
}

interface BrowserWalletHandleInit extends WalletReference {
  creationTransaction?: PreparedTransaction;
  creationTransactions?: PreparedTransaction[];
  addAuthorityChallenge?: AddAuthorityChallenge;
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

function unwrapCreateWalletResponse(
  body: CreateWalletResponseBody,
): CreateWalletResponseWire {
  if ('prepared' in body && body.prepared) {
    return body.prepared;
  }
  if ('data' in body && body.data) {
    return body.data;
  }
  return body as CreateWalletResponseWire;
}

function readResponseError(body: unknown): string | undefined {
  if (isRecord(body) && typeof body.error === 'string') {
    return body.error;
  }
  return undefined;
}

function resolveNetwork(...networks: Array<Network | undefined>): Network {
  const network = networks.find((candidate) => candidate !== undefined);
  if (!network) {
    throw new Error('network is required');
  }
  return network;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
