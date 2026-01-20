import type { SwigApiClient } from '../client.js';
import { ApiError, type ApiResponse, type Network } from '../types.js';
import { request } from '../utils/request.js';
import type { HealthResponse, SignResponse, SponsorResponse } from './types.js';

export class PaymasterApi {
  constructor(private readonly client: SwigApiClient) {}

  #requirePaymasterUrl = (): string => {
    if (!this.client.paymasterUrl) {
      throw new ApiError(
        'Paymaster URL is required for this operation',
        'MISSING_URL',
        0,
      );
    }
    return this.client.paymasterUrl;
  };

  /**
   * Sponsor a transaction (sign and send).
   * @param transaction - Base58-encoded serialized transaction
   * @param network - Network to use ('mainnet' or 'devnet')
   */
  async sponsor(
    transaction: string,
    network: Network,
  ): Promise<ApiResponse<SponsorResponse>> {
    const baseUrl = this.#requirePaymasterUrl();
    const url = `${baseUrl}/sponsor`;
    return request<SponsorResponse>(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify({
          base58_encoded_transaction: transaction,
          network,
        }),
      },
      this.client.retry,
    );
  }

  /**
   * Sign a transaction without sending.
   * @param transaction - Base58-encoded serialized transaction
   * @param network - Network to use ('mainnet' or 'devnet')
   */
  async sign(
    transaction: string,
    network: Network,
  ): Promise<ApiResponse<SignResponse>> {
    const baseUrl = this.#requirePaymasterUrl();
    const url = `${baseUrl}/sign`;
    return request<SignResponse>(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify({
          base58_encoded_transaction: transaction,
          network,
        }),
      },
      this.client.retry,
    );
  }

  /** Check the health of the paymaster service (no auth required). */
  async health(): Promise<ApiResponse<HealthResponse>> {
    const baseUrl = this.#requirePaymasterUrl();
    const url = `${baseUrl}/health`;
    return request<HealthResponse>(url, { method: 'GET' }, this.client.retry);
  }
}
