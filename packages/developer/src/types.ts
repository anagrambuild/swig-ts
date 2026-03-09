export type {
  ActionConfig,
  AuthorityConfig,
  Network,
  RetryOptions,
  WalletType,
} from '@swig-wallet/api';

import type { VersionedTransaction } from '@solana/web3.js';
import type { Network, RetryOptions, WalletType } from '@swig-wallet/api';

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

/**
 * Result when a paymaster was used — the transaction has been signed and sent.
 */
export interface WalletCreatePaymasterResult {
  /** Swig ID (8-byte identifier) */
  swigId: string;
  /** Swig wallet address (Solana public key) */
  swigAddress: string;
  /** Transaction signature */
  signature: string;
}

/**
 * Result when no paymaster was provided — contains the unsigned transaction
 * reconstructed as a VersionedTransaction ready for signing and sending.
 */
export interface WalletCreateTransactionResult {
  /** Swig ID (8-byte identifier) */
  swigId: string;
  /** Swig wallet address (Solana public key) */
  swigAddress: string;
  /** Unsigned VersionedTransaction ready for the caller to sign and send */
  transaction: VersionedTransaction;
}

/**
 * Union result type for wallet creation.
 * When a paymaster is provided, the result contains a `signature`.
 * When no paymaster is provided, the result contains a `transaction`.
 */
export type WalletCreateResult =
  | WalletCreatePaymasterResult
  | WalletCreateTransactionResult;

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
  /**
   * Paymaster public key.
   * When provided, the paymaster signs and sends the transaction on your behalf,
   * and the result contains a `signature`.
   * When omitted, the result contains an unsigned `transaction` (VersionedTransaction)
   * that you must sign and send yourself.
   */
  paymasterPubkey?: string;
}
