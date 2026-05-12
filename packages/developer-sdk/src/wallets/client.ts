import type { HttpClient } from '../core/index.js';
import type {
  CreateWalletArgs,
  CreateWalletResponse,
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
import { normalizePreparedTransaction } from './normalizers.js';
import {
  createWalletRequest,
  executeRequest,
  swapRequest,
  transferRequest,
  walletActionPath,
} from './requests.js';

export class WalletsClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  create = async (args: CreateWalletArgs): Promise<WalletHandle> => {
    const response = await this.http.post<CreateWalletResponse>(
      '/v1/wallets',
      createWalletRequest(args, this.defaultNetwork),
    );

    const wallet = {
      swigId: response.swigId,
      swigConfigAddress: response.swigConfigAddress,
      walletAddress: response.walletAddress,
    };

    return new WalletHandle(this, {
      ...wallet,
      network: response.network ?? args.network ?? this.defaultNetwork,
      creationTransaction: normalizePreparedTransaction({
        ...response,
        wallet: response.wallet ?? wallet,
      }),
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
        roleId: options.roleId,
      });
    }

    return new WalletHandle(this, {
      swigId: wallet.swigId,
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      network: options.network ?? wallet.network ?? this.defaultNetwork,
      roleId: options.roleId,
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
      roleId: options.roleId ?? session.roleId,
    });
  };

  transfer = async (
    wallet: WalletHandle,
    args: TransferArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      walletActionPath(wallet, 'transfer'),
      transferRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  swap = async (
    wallet: WalletHandle,
    args: SwapArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      walletActionPath(wallet, 'swap'),
      swapRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  execute = async (
    wallet: WalletHandle,
    args: ExecuteArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      walletActionPath(wallet, 'execute'),
      executeRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };
}
