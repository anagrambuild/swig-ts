export { DEFAULT_BACKEND_URL, SwigDeveloperSdkError } from '../core/index.js';
export { TransactionsClient } from '../transactions/index.js';
export { WalletHandle, WalletsClient } from '../wallets/index.js';
export {
  SwigClient,
  SwigClient as SwigServerClient,
} from './typescript/index.js';

export type {
  AddRecoveryAuthorityArgs,
  Amount,
  CancelRecoveryArgs,
  ConfigureRecoveryArgs,
  CreateWalletArgs,
  CreateWalletResponse,
  CreateWalletResult,
  ExecuteArgs,
  ExecuteRecoveryArgs,
  IdpWalletSession,
  JsonObject,
  JsonValue,
  Network,
  Policy,
  PolicyAuthority,
  PrepareRecoverySetupArgs,
  PreparedRecoverySetupResult,
  PreparedTransaction,
  PreparedTransactionWire,
  PreparedTransactionsResult,
  RecoverySetupPlan,
  RetryOptions,
  SponsorSignedTransactionArgs,
  StartRecoveryArgs,
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
