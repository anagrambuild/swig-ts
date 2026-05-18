export { DEFAULT_BACKEND_URL, SwigDeveloperSdkError } from '../core/index.js';
export { TransactionsClient } from '../transactions/index.js';
export { WalletHandle, WalletsClient } from '../wallets/index.js';
export {
  SwigClient,
  SwigClient as SwigServerClient,
} from './typescript/index.js';

export type {
  Amount,
  CreateWalletArgs,
  CreateWalletResponse,
  ExecuteArgs,
  IdpWalletSession,
  JsonObject,
  JsonValue,
  Network,
  PreparedTransaction,
  PreparedTransactionWire,
  RetryOptions,
  SponsorSignedTransactionArgs,
  SubmittedTransaction,
  SubmittedTransactionWire,
  SwapArgs,
  SwigClientConfig,
  TransactionEncoding,
  TransferArgs,
  WalletAddressInfo,
  WalletHandleOptions,
  WalletReference,
} from '../types/index.js';
