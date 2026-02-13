export type {
  ActionConfig,
  AuthorityConfig,
  Network,
  RetryOptions,
  WalletType,
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
  /** Optional signer ID to override or provide (alternative to walletAddress + walletType) */
  signerId?: string;
  /**
   * Wallet public key to use as the authority (alternative to signerId).
   * Must be provided together with walletType.
   */
  walletAddress?: string;
  /**
   * Authority type for the wallet (alternative to signerId).
   * Must be provided together with walletAddress.
   */
  walletType?: WalletType;
  /**
   * Maximum session duration in slots (only valid for session authority types).
   * String to safely handle bigint values.
   */
  maxDurationSlots?: string;
  /** Optional swig ID (generated if not provided) */
  swigId?: string;
  /** Network to use ('mainnet' or 'devnet') */
  network: Network;
  /** Paymaster public key */
  paymasterPubkey: string;
}
