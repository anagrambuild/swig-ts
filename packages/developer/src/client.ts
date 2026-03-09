import { VersionedTransaction } from '@solana/web3.js';
import type { CreateWalletTransactionResponse } from '@swig-wallet/api';
import { SwigApiClient } from '@swig-wallet/api';
import bs58 from 'bs58';
import { SwigError } from './error.js';
import { Policy } from './models/index.js';
import type {
  SwigConfig,
  WalletCreateArgs,
  WalletCreateResult,
} from './types.js';

function isTransactionResponse(
  data: unknown,
): data is CreateWalletTransactionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'transaction' in data &&
    typeof (data as Record<string, unknown>).transaction === 'string'
  );
}

export class SwigClient {
  readonly #api: SwigApiClient;

  constructor(config: SwigConfig) {
    this.#api = new SwigApiClient({
      apiKey: config.apiKey,
      portalUrl: config.baseUrl,
      paymasterUrl: config.paymasterUrl ?? config.baseUrl,
      retry: config.retryOptions,
    });
  }

  getPolicy = async (policyId: string): Promise<Policy> => {
    const { data, error } = await this.#api.policies.get(policyId);
    if (error || !data) {
      throw SwigError.fromApiError(error!);
    }
    return Policy.fromConfig(data);
  };

  /**
   * Create a new Swig wallet.
   *
   * When `paymasterPubkey` is provided, the paymaster signs and sends the
   * transaction, and the result contains a `signature` field.
   *
   * When `paymasterPubkey` is omitted, the API returns a serialized unsigned
   * transaction. This method reconstructs it into a `VersionedTransaction` and
   * returns it in the `transaction` field. The caller is responsible for signing
   * and sending the transaction.
   */
  createWallet = async (
    args: WalletCreateArgs,
  ): Promise<WalletCreateResult> => {
    const { data, error } = await this.#api.wallet.create(args);
    if (error || !data) {
      throw SwigError.fromApiError(error!);
    }

    // If the response contains a base58-encoded transaction (no-paymaster flow),
    // reconstruct it into a VersionedTransaction object.
    if (isTransactionResponse(data)) {
      const txBytes = bs58.decode(data.transaction);
      const transaction = VersionedTransaction.deserialize(txBytes);
      return {
        swigId: data.swigId,
        swigAddress: data.swigAddress,
        transaction,
      };
    }

    // Paymaster flow: the response already contains the signature
    return data;
  };
}
