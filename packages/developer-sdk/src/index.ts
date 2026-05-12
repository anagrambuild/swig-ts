export { SwigClient } from './client.js';
export { DEFAULT_BACKEND_URL, SwigDeveloperSdkError } from './core/index.js';
export { createSecp256r1PasskeySigningFn } from './passkeys/index.js';
export { TransactionsClient } from './transactions/index.js';
export { WalletHandle, WalletsClient } from './wallets/index.js';

export type {
  Amount,
  CreateWalletArgs,
  CreateWalletResponse,
  ExecuteArgs,
  IdpWalletSession,
  JsonObject,
  JsonValue,
  Network,
  PasskeySigningFn,
  PasskeySigningResult,
  PreparedTransaction,
  PreparedTransactionWire,
  RetryOptions,
  SolanaAccountMeta,
  SolanaInstruction,
  SolanaInstructionInput,
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
} from './types/index.js';
