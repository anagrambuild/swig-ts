import type { SwigApiClient } from '../client.js';
import { ApiError, type ApiResponse } from '../types.js';
import { request } from '../utils/request.js';
import type { Policy } from './types.js';

export class PoliciesApi {
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

  async get(policyId: string): Promise<ApiResponse<Policy>> {
    const baseUrl = this.#requirePortalUrl();
    const url = `${baseUrl}/wallet/policies/${encodeURIComponent(policyId)}`;
    return request<Policy>(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
        },
      },
      this.client.retry,
    );
  }
}
