export type {
  ActionConfig,
  AuthorityConfig,
  Network,
  RetryOptions,
} from '@swig-wallet/api';

import type { Network, RetryOptions } from '@swig-wallet/api';

export interface SwigConfig {
  /** API key for authenticating with the Portal API */
  apiKey: string;
  /** Base URL of the Portal API */
  baseUrl: string;
  /** Base URL of the Paymaster API (optional, defaults to baseUrl) */
  paymasterUrl?: string;
  /** Optional retry configuration for failed API requests */
  retryOptions?: RetryOptions;
}

export interface WalletCreateResult {
  /** Swig ID (8-byte identifier) */
  swigId: string;
  /** Swig wallet address (Solana public key) */
  swigAddress: string;
  /** Transaction signature */
  signature: string;
}

export interface WalletCreateArgs {
  /** Policy ID to use for wallet creation */
  policyId: string;
  /** Optional signer ID to override or provide */
  signerId?: string;
  /** Optional swig ID (generated if not provided) */
  swigId?: string;
  /** Network to use ('mainnet' or 'devnet') */
  network: Network;
  /** Paymaster public key */
  paymasterPubkey: string;
}
