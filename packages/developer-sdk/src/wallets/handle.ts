import type {
  AddAuthorityChallenge,
  ExecuteArgs,
  Network,
  PreparedTransaction,
  SwapArgs,
  TransferArgs,
  WalletReference,
} from '../types/index.js';
import type { WalletsClient } from './client.js';

export interface WalletHandleInit extends WalletReference {
  creationTransaction?: PreparedTransaction;
  creationTransactions?: PreparedTransaction[];
  addAuthorityChallenge?: AddAuthorityChallenge;
}

export class WalletHandle {
  readonly swigId?: string;
  readonly swigConfigAddress: string;
  readonly walletAddress?: string;
  readonly network?: Network;
  readonly requesterPubkey?: string;
  readonly creationTransaction?: PreparedTransaction;
  readonly creationTransactions: PreparedTransaction[];
  readonly addAuthorityChallenge?: AddAuthorityChallenge;

  constructor(
    private readonly wallets: WalletsClient,
    init: WalletHandleInit,
  ) {
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
  }

  transfer = (args: TransferArgs) => this.wallets.transfer(this, args);

  swap = (args: SwapArgs) => this.wallets.swap(this, args);

  execute = (args: ExecuteArgs) => this.wallets.execute(this, args);
}
