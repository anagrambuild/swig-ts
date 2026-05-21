import type { HttpClient } from '../core/index.js';
import type {
  CancelRecoveryArgs,
  CreateWalletArgs,
  CreateWalletResponseWire,
  CreateWalletResult,
  ExecuteArgs,
  ExecuteRecoveryArgs,
  IdpWalletSession,
  Network,
  PrepareArgs,
  PreparedTransaction,
  PreparedTransactionsResult,
  PreparedTransactionWire,
  PrepareTransactionsResponseWire,
  StartRecoveryArgs,
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
  cancelRecoveryRequest,
  createWalletRequest,
  executeRecoveryRequest,
  executeRequest,
  isTokenTransfer,
  prepareRequest,
  startRecoveryRequest,
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

  startRecovery = async (
    wallet: WalletHandle,
    args: StartRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/start',
      startRecoveryRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  cancelRecovery = async (
    wallet: WalletHandle,
    args: CancelRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/cancel',
      cancelRecoveryRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  executeRecovery = async (
    wallet: WalletHandle,
    args: ExecuteRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/execute',
      executeRecoveryRequest(wallet, args, this.defaultNetwork),
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
