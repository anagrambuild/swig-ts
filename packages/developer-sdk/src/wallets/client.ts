import type { HttpClient } from '../core/index.js';
import type {
  CreateWalletArgs,
  CreateWalletResponseWire,
  ExecuteArgs,
  IdpWalletSession,
  Network,
  PreparedTransaction,
  PreparedTransactionWire,
  SwapArgs,
  TransferArgs,
  WalletHandleOptions,
  WalletReference,
} from '../types/index.js';
import { WalletHandle } from './handle.js';
import {
  normalizeCreateWalletResponse,
  normalizePreparedTransaction,
} from './normalizers.js';
import {
  createWalletRequest,
  executeRequest,
  isTokenTransfer,
  swapRequest,
  transferSolRequest,
  transferTokenRequest,
} from './requests.js';

export class WalletsClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  create = async (args: CreateWalletArgs): Promise<WalletHandle> => {
    const response = await this.http.post<CreateWalletResponseWire>(
      '/transaction/wallet/create',
      createWalletRequest(args, this.defaultNetwork),
    );
    const created = normalizeCreateWalletResponse(response);

    return new WalletHandle(this, {
      ...created.wallet,
      network: created.network ?? args.network ?? this.defaultNetwork,
      creationTransaction: created.creationTransaction,
      creationTransactions: created.transactions,
      addAuthorityChallenge: created.addAuthorityChallenge,
    });
  };

  use = (
    wallet: string | WalletReference,
    options: WalletHandleOptions = {},
  ): WalletHandle => {
    if (typeof wallet === 'string') {
      return new WalletHandle(this, {
        swigConfigAddress: wallet,
        network: options.network ?? this.defaultNetwork,
        requesterPubkey: options.requesterPubkey,
      });
    }

    return new WalletHandle(this, {
      swigId: wallet.swigId,
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      network: options.network ?? wallet.network ?? this.defaultNetwork,
      requesterPubkey: options.requesterPubkey ?? wallet.requesterPubkey,
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
      requesterPubkey: options.requesterPubkey ?? session.requesterPubkey,
    });
  };

  transfer = async (
    wallet: WalletHandle,
    args: TransferArgs,
  ): Promise<PreparedTransaction> => {
    const path = isTokenTransfer(args)
      ? '/transaction/transfer/spl-token'
      : '/transaction/transfer/sol';
    const body = isTokenTransfer(args)
      ? transferTokenRequest(wallet, args, this.defaultNetwork)
      : transferSolRequest(wallet, args, this.defaultNetwork);
    const response = await this.http.post<PreparedTransactionWire>(path, body);
    return normalizePreparedTransaction(response);
  };

  swap = async (
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
