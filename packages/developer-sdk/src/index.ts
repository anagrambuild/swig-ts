export { DEFAULT_BACKEND_URL, SwigDeveloperSdkError } from './core/index.js';
export { PaymasterClient } from './paymaster/index.js';
export { SwigClient } from './server/typescript/index.js';
export { TransactionsClient } from './transactions/index.js';
export { WalletHandle, WalletsClient } from './wallets/index.js';

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
  SolanaAccountMeta,
  SolanaInstruction,
  SolanaInstructionInput,
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
} from './types/index.js';
