/**
 * Paymaster client for transaction sponsorship.
 *
 * @packageDocumentation
 */

import { getBase58Codec } from '@solana/kit';
import { SwigApiClient } from '@swig-wallet/api';
import { isPaymasterFeePayer } from './helpers.js';
import { createIdempotencyKey } from './idempotency.js';
import { serializedBundleHasSufficientJitoTip } from './jito.js';
import type {
  PaymasterConfig,
  PaymasterSubmitOptions,
  SerializedTransaction,
  SponsorBundleResult,
} from './types.js';
import { PaymasterError } from './types.js';

/**
 * Client for interacting with the Swig Paymaster service.
 * Provides methods to convert transactions to paymaster transactions,
 * sign them, and submit them to the paymaster API for sponsorship.
 */
export class PaymasterClient {
  readonly #api: SwigApiClient;
  readonly #paymasterPubkey: string;
  readonly #network: 'mainnet' | 'devnet';

  /**
   * Creates a new PaymasterClient instance.
   *
   * @param config - Configuration options for the client
   *
   * @example
   * ```ts
   * const client = new PaymasterClient({
   *   apiKey: 'your-api-key',
   *   paymasterPubkey: 'YourPaymasterPublicKey...',
   *   baseUrl: 'https://paymaster-api.example.com',
   *   network: 'mainnet',
   * });
   * ```
   */
  constructor(config: PaymasterConfig) {
    this.#api = new SwigApiClient({
      apiKey: config.apiKey,
      paymasterUrl: config.baseUrl,
      retry: config.retryOptions,
    });
    this.#paymasterPubkey = config.paymasterPubkey;
    this.#network = config.network;
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
    return isPaymasterFeePayer(serializedTx, this.#paymasterPubkey);
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
   * @throws {PaymasterError} If API request fails
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
    if (!this.isPaymasterFeePayer(serializedTx)) {
      throw new PaymasterError('Paymaster public key not set as fee payer');
    }

    const base58Tx = getBase58Codec().decode(serializedTx);
    const { data, error } = await this.#api.paymaster.sign(
      base58Tx,
      this.#network,
    );

    if (error || !data) {
      throw PaymasterError.fromApiError(error!);
    }

    return new Uint8Array(getBase58Codec().encode(data.signed_transaction));
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
   * @throws {PaymasterError} If API request or network submission fails
   *
   * @example
   * ```ts
   * const signature = await client.signAndSendSerializedTransaction(transaction);
   * console.log(`Transaction confirmed: ${signature}`);
   * ```
   */
  public async signAndSendSerializedTransaction(
    serializedTx: SerializedTransaction,
    options?: PaymasterSubmitOptions,
  ): Promise<string> {
    if (!this.isPaymasterFeePayer(serializedTx)) {
      throw new PaymasterError('Paymaster public key not set as fee payer');
    }

    const base58Tx = getBase58Codec().decode(serializedTx);
    const { data, error } = await this.#api.paymaster.sponsor(
      base58Tx,
      this.#network,
      options?.idempotencyKey ?? createIdempotencyKey(),
    );

    if (error || !data) {
      throw PaymasterError.fromApiError(error!);
    }

    return data.signature;
  }

  /**
   * Signs serialized transactions with the paymaster and submits them as a
   * Jito bundle.
   *
   * Already-signed user transactions are never mutated. The submitted bundle
   * must already contain at least 1,000 aggregate Jito tip lamports.
   *
   * @param serializedTransactions - Serialized transactions with paymaster as fee payer
   * @param options - Optional submission settings
   * @returns Jito Block Engine acceptance result. The bundle may still be pending.
   */
  public async signAndSendBundleSerializedTransactions(
    serializedTransactions: SerializedTransaction[],
    options?: PaymasterSubmitOptions,
  ): Promise<SponsorBundleResult> {
    if (this.#network !== 'mainnet') {
      throw new PaymasterError('Jito bundles are only supported on mainnet');
    }

    if (serializedTransactions.length === 0) {
      throw new PaymasterError('At least one transaction is required');
    }

    if (serializedTransactions.length > 5) {
      throw new PaymasterError('Jito bundles support at most 5 transactions');
    }

    for (const [index, transaction] of serializedTransactions.entries()) {
      if (!this.isPaymasterFeePayer(transaction)) {
        throw new PaymasterError(
          `Paymaster public key not set as fee payer for transaction ${index}`,
        );
      }
    }

    if (
      !serializedBundleHasSufficientJitoTip(
        serializedTransactions,
        this.#paymasterPubkey,
      )
    ) {
      throw new PaymasterError(
        'Jito bundle must include at least 1000 lamports in recognized tip instructions',
      );
    }

    const base58Transactions = serializedTransactions.map((transaction) =>
      getBase58Codec().decode(transaction),
    );
    const { data, error } = await this.#api.paymaster.sponsorBundle(
      base58Transactions,
      this.#network,
      options?.idempotencyKey ?? createIdempotencyKey(),
    );

    if (error || !data) {
      throw PaymasterError.fromApiError(error!);
    }

    return {
      requestId: data.request_id,
      bundleId: data.bundle_id,
      signatures: data.signatures,
      estimatedSpentByPaymaster: BigInt(data.estimated_spent_by_paymaster),
    };
  }
}
