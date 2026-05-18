import type { HttpClient } from '../core/index.js';
import type {
  CreateWalletArgs,
  CreateWalletResponseWire,
  CreateWalletResult,
  ExecuteArgs,
  IdpWalletSession,
  Network,
  PrepareArgs,
  PreparedTransaction,
  PreparedTransactionsResult,
  PreparedTransactionWire,
  PrepareTransactionsResponseWire,
  SwapArgs,
  TransferArgs,
  WalletHandleOptions,
  WalletReference,
} from '../types/index.js';
import { WalletHandle } from './handle.js';
import {
  normalizeCreateWalletResponse,
  normalizePreparedTransaction,
  normalizePrepareTransactionsResponse,
} from './normalizers.js';
import {
  createWalletRequest,
  executeRequest,
  isTokenTransfer,
  prepareRequest,
  swapRequest,
  transferSolRequest,
  transferTokenRequest,
} from './requests.js';

export class WalletsClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  create = async (args: CreateWalletArgs): Promise<CreateWalletResult> => {
    const response = await this.http.post<CreateWalletResponseWire>(
      '/transaction/wallet/create',
      createWalletRequest(args, this.defaultNetwork),
    );
    const created = normalizeCreateWalletResponse(response);

    return {
      ...created,
      wallet: {
        ...created.wallet,
        network: created.network ?? args.network ?? this.defaultNetwork,
      },
      network: created.network ?? args.network ?? this.defaultNetwork,
    };
  };

  use = (
    wallet: string | WalletReference,
    options: WalletHandleOptions = {},
  ): WalletHandle => {
    if (typeof wallet === 'string') {
      return new WalletHandle(this, {
        swigConfigAddress: wallet,
        network: options.network ?? this.defaultNetwork,
        requesterAuthority: options.requesterAuthority,
      });
    }

    return new WalletHandle(this, {
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      network: options.network ?? wallet.network ?? this.defaultNetwork,
      requesterAuthority:
        options.requesterAuthority ?? wallet.requesterAuthority,
    });
  };

  fromIdpSession = (
    session: IdpWalletSession,
    options: WalletHandleOptions = {},
  ): WalletHandle => {
    return new WalletHandle(this, {
      swigConfigAddress: session.configAddress,
      walletAddress: session.walletAddress,
      network: options.network ?? this.defaultNetwork,
      requesterAuthority:
        options.requesterAuthority ?? session.requesterAuthority,
    });
  };

  transfer = async (
    wallet: WalletHandle,
    args: TransferArgs,
  ): Promise<PreparedTransaction> => {
    return isTokenTransfer(args)
      ? this.transferToken(wallet, args)
      : this.transferSol(wallet, args);
  };

  prepare = async (
    wallet: WalletHandle,
    args: PrepareArgs,
  ): Promise<PreparedTransactionsResult> => {
    const response = await this.http.post<PrepareTransactionsResponseWire>(
      '/transaction/prepare',
      prepareRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePrepareTransactionsResponse(response);
  };

  transferSol = async (
    wallet: WalletHandle,
    args: Extract<TransferArgs, { destination: string }>,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/transfer/sol',
      transferSolRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  transferToken = async (
    wallet: WalletHandle,
    args: Extract<TransferArgs, { mint: string }>,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/transfer/spl-token',
      transferTokenRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  swap = async (
    wallet: WalletHandle,
    args: SwapArgs,
  ): Promise<PreparedTransaction> => {
    return this.jupiterSwap(wallet, args);
  };

  jupiterSwap = async (
    wallet: WalletHandle,
    args: SwapArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/swap/jupiter',
      swapRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  execute = async (
    wallet: WalletHandle,
    args: ExecuteArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      `/v1/wallets/${encodeURIComponent(wallet.swigConfigAddress)}/execute`,
      executeRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };
}
