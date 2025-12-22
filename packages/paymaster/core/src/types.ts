/**
 * Configuration options for the PaymasterClient
 *
 * Contains all settings required to initialize and configure the paymaster client,
 * including authentication, network settings, and optional retry behavior.
 *
 * @see {@link RetryOptions} for configuring retry behavior
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
  /**
   * Optional retry configuration for failed API requests
   * @see {@link RetryOptions}
   */
  retryOptions?: RetryOptions;
}

/**
 * Serialized transaction type used throughout the paymaster API.
 *
 * Represents a transaction as a Uint8Array of bytes. This is the standard
 * format for passing transactions between methods in the paymaster client.
 */
export type SerializedTransaction = Uint8Array;

/**
 * Response from the paymaster sponsor endpoint
 */
export interface SponsorResponse {
  /** Unique identifier for this sponsorship request */
  request_id: string;
  /** Transaction signature returned by the network */
  signature: string;
  /** Amount of lamports spent by the paymaster to execute this transaction */
  spent_by_paymaster: number;
}

/**
 * Request body for the sponsor endpoint
 */
export interface SponsorRequest {
  /** Base58 encoded transaction string */
  base58_encoded_transaction: string;
  /** Network to submit the transaction to */
  network: 'mainnet' | 'devnet';
}

/**
 * Request body for the sign endpoint
 */
export interface SignRequest {
  /** Base58 encoded transaction string */
  base58_encoded_transaction: string;
  /** Network to use */
  network: 'mainnet' | 'devnet';
}

/**
 * Response from the paymaster sign endpoint
 */
export interface SignResponse {
  /** Unique identifier for this request */
  request_id: string;
  /** Signed transaction as base58 string */
  signed_transaction: string;
}

/**
 * Configuration options for retry logic when making API requests.
 *
 * Controls how the paymaster client retries failed requests using
 * exponential backoff. Only server errors (5xx) and network errors
 * are retried; client errors (4xx) fail immediately.
 *
 * @example
 * ```ts
 * const retryOptions: RetryOptions = {
 *   maxRetries: 5,
 *   retryDelay: 2000,
 *   backoffMultiplier: 1.5
 * };
 * ```
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds between retries (default: 1000) */
  retryDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
}

/**
 * Error thrown by the PaymasterClient when API requests or operations fail.
 *
 * Contains additional context including HTTP status codes and response data
 * to help diagnose issues with paymaster operations.
 *
 * @example
 * ```ts
 * try {
 *   await client.signAndSendSerializedTransaction(tx);
 * } catch (error) {
 *   if (error instanceof PaymasterError) {
 *     console.error('Paymaster error:', error.message);
 *     console.error('Status code:', error.statusCode);
 *     console.error('Response:', error.response);
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
}
