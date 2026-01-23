import type { SwigApiClient } from '../client.js';
import { ApiError, type ApiResponse } from '../types.js';
import { request } from '../utils/request.js';
import type { CreateWalletRequest, CreateWalletResponse } from './types.js';

export class WalletApi {
  constructor(private readonly client: SwigApiClient) {}

  #requirePortalUrl = (): string => {
    if (!this.client.portalUrl) {
      throw new ApiError(
        'Portal URL is required for this operation',
        'MISSING_URL',
        0,
      );
    }
    return this.client.portalUrl;
  };

  async create(
    walletRequest: CreateWalletRequest,
  ): Promise<ApiResponse<CreateWalletResponse>> {
    const baseUrl = this.#requirePortalUrl();
    const url = `${baseUrl}/api/v1/wallet/create`;
    return request<CreateWalletResponse>(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify(walletRequest),
      },
      this.client.retry,
    );
  }
}
