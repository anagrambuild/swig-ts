import type {
  CancelRecoveryArgs,
  ExecuteArgs,
  ExecuteRecoveryArgs,
  Network,
  PrepareArgs,
  PreparedRecoverySetupResult,
  PreparedTransaction,
  PreparedTransactionsResult,
  PrepareRecoverySetupArgs,
  StartRecoveryArgs,
  SwapArgs,
  TransferArgs,
  TransferSolArgs,
  TransferTokenArgs,
  WalletReference,
} from '../types/index.js';
import type { WalletsClient } from './client.js';

export type WalletHandleInit = WalletReference;

export type WalletTransferClient = {
  (args: TransferArgs): Promise<PreparedTransaction>;
  sol(args: TransferSolArgs): Promise<PreparedTransaction>;
  token(args: TransferTokenArgs): Promise<PreparedTransaction>;
  splToken(args: TransferTokenArgs): Promise<PreparedTransaction>;
};

export type WalletSwapClient = {
  (args: SwapArgs): Promise<PreparedTransaction>;
  jupiter(args: SwapArgs): Promise<PreparedTransaction>;
};

export type WalletRecoveryClient = {
  prepareSetup(
    args: PrepareRecoverySetupArgs,
  ): Promise<PreparedRecoverySetupResult>;
  start(args: StartRecoveryArgs): Promise<PreparedTransaction>;
  cancel(args: CancelRecoveryArgs): Promise<PreparedTransaction>;
  execute(args: ExecuteRecoveryArgs): Promise<PreparedTransaction>;
};

export class WalletHandle {
  readonly swigConfigAddress: string;
  readonly walletAddress?: string;
  readonly network?: Network;
  readonly requesterAuthority?: WalletReference['requesterAuthority'];
  readonly transfer: WalletTransferClient;
  readonly swap: WalletSwapClient;
  readonly recovery: WalletRecoveryClient;

  constructor(
    private readonly wallets: WalletsClient,
    init: WalletHandleInit,
  ) {
    this.swigConfigAddress = init.swigConfigAddress;
    this.walletAddress = init.walletAddress;
    this.network = init.network;
    this.requesterAuthority = init.requesterAuthority;
    this.transfer = createWalletTransferClient(wallets, this);
    this.swap = createWalletSwapClient(wallets, this);
    this.recovery = createWalletRecoveryClient(wallets, this);
  }

  prepare = (args: PrepareArgs): Promise<PreparedTransactionsResult> =>
    this.wallets.prepare(this, args);

  execute = (args: ExecuteArgs) => this.wallets.execute(this, args);
}

function createWalletTransferClient(
  wallets: WalletsClient,
  wallet: WalletHandle,
): WalletTransferClient {
  const transfer = ((args: TransferArgs) =>
    wallets.transfer(wallet, args)) as WalletTransferClient;

  transfer.sol = (args: TransferSolArgs) => wallets.transferSol(wallet, args);
  transfer.token = (args: TransferTokenArgs) =>
    wallets.transferToken(wallet, args);
  transfer.splToken = transfer.token;

  return transfer;
}

function createWalletSwapClient(
  wallets: WalletsClient,
  wallet: WalletHandle,
): WalletSwapClient {
  const swap = ((args: SwapArgs) =>
    wallets.swap(wallet, args)) as WalletSwapClient;
  swap.jupiter = (args: SwapArgs) => wallets.jupiterSwap(wallet, args);

  return swap;
}

function createWalletRecoveryClient(
  wallets: WalletsClient,
  wallet: WalletHandle,
): WalletRecoveryClient {
  return {
    prepareSetup: (args: PrepareRecoverySetupArgs) =>
      wallets.prepareRecoverySetup(wallet, args),
    start: (args: StartRecoveryArgs) => wallets.startRecovery(wallet, args),
    cancel: (args: CancelRecoveryArgs) => wallets.cancelRecovery(wallet, args),
    execute: (args: ExecuteRecoveryArgs) =>
      wallets.executeRecovery(wallet, args),
  };
}
