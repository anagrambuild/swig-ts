/**
 * Type definitions for the Paymaster SDK.
 *
 * @packageDocumentation
 */

import type { ApiError, RetryOptions } from '@swig-wallet/api';

/**
 * Configuration options for the PaymasterClient
 *
 * Contains all settings required to initialize and configure the paymaster client,
 * including authentication, network settings, and optional retry behavior.
 */
export interface PaymasterConfig {
  /** API key for authenticating with the paymaster service */
  apiKey: string;
  /** Public key address of the paymaster account */
  paymasterPubkey: string;
  /** Base URL of the paymaster API endpoint */
  baseUrl: string;
  /** Solana network to use (mainnet or devnet) */
  network: 'mainnet' | 'devnet';
  /**
   * Custom RPC URL to use instead of default Solana RPC endpoints.
   * If not provided, defaults to public Solana endpoints based on network.
   */
  customRpcUrl?: string;
  /** Optional retry configuration for failed API requests */
  retryOptions?: RetryOptions;
}

/**
 * Serialized transaction type used throughout the paymaster API.
 *
 * Represents a transaction as a Uint8Array of bytes.
 */
export type SerializedTransaction = Uint8Array;

/**
 * Error thrown by the PaymasterClient when API requests or operations fail.
 *
 * @example
 * ```ts
 * try {
 *   await client.signAndSendSerializedTransaction(tx);
 * } catch (error) {
 *   if (error instanceof PaymasterError) {
 *     console.error('Paymaster error:', error.message);
 *     console.error('Status code:', error.statusCode);
 *   }
 * }
 * ```
 */
export class PaymasterError extends Error {
  constructor(
    message: string,
    /** HTTP status code if the error came from an API request */
    public readonly statusCode?: number,
    /** Raw response data from the failed request */
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = 'PaymasterError';
  }

  static fromApiError = (error: ApiError): PaymasterError => {
    return new PaymasterError(error.message, error.status, error.details);
  };
}

// Re-export for convenience
export type { RetryOptions };
