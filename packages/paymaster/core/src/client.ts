import { getBase58Codec } from '@solana/kit';
import { isPaymasterFeePayer } from './helpers.js';
import type {
  PaymasterConfig,
  RetryOptions,
  SerializedTransaction,
  SignRequest,
  SignResponse,
  SponsorRequest,
  SponsorResponse,
} from './types.js';
import { PaymasterError } from './types.js';

/**
 * Client for interacting with the Swig Paymaster service.
 * Provides methods to convert transactions to paymaster transactions,
 * sign them, and submit them to the paymaster API for sponsorship.
 */
export class PaymasterClient {
  private readonly apiKey: string;
  private readonly paymasterPubkey: PaymasterConfig['paymasterPubkey'];
  private readonly baseUrl: string;
  private readonly network: PaymasterConfig['network'];
  private readonly retryOptions: Required<RetryOptions>;

  /**
   * Creates a new PaymasterClient instance.
   *
   * @param config - Configuration options for the client
   *
   * @example
   * ```ts
   * const client = new PaymasterClient({
   *   apiKey: 'your-api-key',
   *   paymasterPubkey: address('YourPaymasterPublicKey...'),
   *   baseUrl: 'https://paymaster-api.example.com',
   *   network: 'mainnet',
   *   retryOptions: {
   *     maxRetries: 5,
   *     retryDelay: 2000,
   *     backoffMultiplier: 1.5
   *   }
   * });
   * ```
   */
  constructor(config: PaymasterConfig) {
    this.apiKey = config.apiKey;
    this.paymasterPubkey = config.paymasterPubkey;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.network = config.network;
    this.retryOptions = {
      maxRetries: config.retryOptions?.maxRetries ?? 3,
      retryDelay: config.retryOptions?.retryDelay ?? 1000,
      backoffMultiplier: config.retryOptions?.backoffMultiplier ?? 2,
    };
  }

  /**
   * Checks if a serialized transaction has the paymaster set as the fee payer.
   *
   * Use this method to validate that a transaction was properly configured
   * with the paymaster as the fee payer before attempting to sign or send it.
   *
   * @param serializedTx - Serialized transaction to check
   * @returns True if paymaster is the fee payer, false otherwise
   *
   * @example
   * ```ts
   * const isValid = client.isPaymasterFeePayer(serializedTransaction);
   * if (!isValid) {
   *   throw new Error('Transaction not configured for paymaster');
   * }
   * ```
   */
  public isPaymasterFeePayer(serializedTx: SerializedTransaction) {
    return isPaymasterFeePayer(serializedTx, this.paymasterPubkey);
  }

  /**
   * Signs a serialized transaction with the paymaster's private key.
   *
   * This method sends the transaction to the paymaster API for signing and returns
   * the signed transaction without submitting it to the network. Use this when you
   * need to inspect or further process the signed transaction before submission.
   *
   * @param serializedTx - Serialized transaction with paymaster as fee payer
   * @returns Signed serialized transaction ready for submission
   *
   * @throws {PaymasterError} If paymaster is not set as fee payer
   * @throws {PaymasterError} If API request fails after all retries
   *
   * @see {@link signAndSendSerializedTransaction} to sign and submit in one step
   *
   * @example
   * ```ts
   * const signedTx = await client.signSerializedTransaction(unsignedTx);
   * // Inspect or modify signedTx before sending
   * ```
   */
  public async signSerializedTransaction(
    serializedTx: SerializedTransaction,
  ): Promise<SerializedTransaction> {
    const isPaymasterTransaction = this.isPaymasterFeePayer(serializedTx);

    if (!isPaymasterTransaction) {
      throw new PaymasterError('Paymaster public key not set as fee payer');
    }

    const tx = getBase58Codec().decode(serializedTx);

    // Send to paymaster sign API with retry logic
    const { signed_transaction } = await this.sendWithRetry<
      SignRequest,
      SignResponse
    >(
      '/sign',
      { base58_encoded_transaction: tx, network: this.network },
      'sign transaction',
    );

    const serializedSignedTransaction =
      getBase58Codec().encode(signed_transaction);

    // Decode the transaction from bytes
    return new Uint8Array(serializedSignedTransaction);
  }

  /**
   * Signs a serialized transaction and submits it to the Solana network.
   *
   * This is a convenience method that combines signing and network submission
   * in a single operation. The transaction is signed by the paymaster and
   * immediately sent to the network for execution.
   *
   * @param serializedTx - Serialized transaction with paymaster as fee payer
   * @returns Transaction signature from the network
   *
   * @throws {PaymasterError} If paymaster is not set as fee payer
   * @throws {PaymasterError} If API request or network submission fails after all retries
   *
   * @see {@link signSerializedTransaction} to sign without sending
   *
   * @example
   * ```ts
   * const signature = await client.signAndSendSerializedTransaction(transaction);
   * console.log(`Transaction confirmed: ${signature}`);
   * ```
   */
  public async signAndSendSerializedTransaction(
    serializedTx: SerializedTransaction,
  ): Promise<string> {
    const isPaymasterTransaction = this.isPaymasterFeePayer(serializedTx);

    if (!isPaymasterTransaction) {
      throw new PaymasterError('Paymaster public key not set as fee payer');
    }

    const tx = getBase58Codec().decode(serializedTx);

    // Send to paymaster API with retry logic
    const { signature } = await this.sendWithRetry<
      SponsorRequest,
      SponsorResponse
    >(
      '/sponsor',
      {
        base58_encoded_transaction: tx,
        network: this.network,
      },
      'sign_and_send transaction',
    );

    return signature;
  }

  /**
   * Sends a request to the paymaster API with exponential backoff retry logic.
   *
   * Automatically retries failed requests with exponential backoff based on the
   * configured retry options. Only retries on server errors (5xx) and network errors;
   * client errors (4xx) fail immediately as they typically indicate invalid requests.
   *
   * @param endpoint - The API endpoint to call (e.g., '/sign' or '/sponsor')
   * @param requestBody - The request body to send
   * @param errorContext - Context string for error messages (e.g., 'sign transaction')
   * @returns Response from the paymaster API
   *
   * @throws {PaymasterError} If all retry attempts fail or on client errors (4xx)
   *
   * @internal This method is used internally by public transaction methods
   */
  private async sendWithRetry<TRequest, TResponse>(
    endpoint: string,
    requestBody: TRequest,
    errorContext: string,
  ): Promise<TResponse> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.retryOptions.maxRetries) {
      try {
        return await this.sendRequest<TRequest, TResponse>(
          endpoint,
          requestBody,
          errorContext,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx), only on server errors (5xx) and network errors
        if (error instanceof PaymasterError && error.statusCode) {
          if (error.statusCode >= 400 && error.statusCode < 500) {
            // Client error - don't retry
            throw error;
          }
        }

        attempt++;

        if (attempt <= this.retryOptions.maxRetries) {
          // Calculate delay with exponential backoff
          const delay =
            this.retryOptions.retryDelay *
            Math.pow(this.retryOptions.backoffMultiplier, attempt - 1);

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new PaymasterError(
      `Failed to ${errorContext} after ${this.retryOptions.maxRetries} retries: ${lastError?.message}`,
      undefined,
      lastError,
    );
  }

  /**
   * Sends a single HTTP request to the paymaster API.
   *
   * Makes a single attempt to call the paymaster API without retry logic.
   * This is called by {@link sendWithRetry} for each retry attempt.
   *
   * @param endpoint - The API endpoint to call (e.g., '/sign' or '/sponsor')
   * @param requestBody - The request body to send
   * @param errorContext - Context string for error messages (e.g., 'sign transaction')
   * @returns Response from the paymaster API
   *
   * @throws {PaymasterError} If the request fails
   *
   * @internal This method is used internally by {@link sendWithRetry}
   */
  private async sendRequest<TRequest, TResponse>(
    endpoint: string,
    requestBody: TRequest,
    errorContext: string,
  ): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new PaymasterError(
          `Paymaster ${errorContext} API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorText,
        );
      }

      const data = await response.json();
      return data as TResponse;
    } catch (error) {
      if (error instanceof PaymasterError) {
        throw error;
      }

      // Network error or other fetch error
      throw new PaymasterError(
        `Network error while ${errorContext}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error,
      );
    }
  }
}
