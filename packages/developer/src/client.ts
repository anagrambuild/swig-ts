import { SwigApiClient } from '@swig-wallet/api';
import { SwigError } from './error.js';
import { Policy } from './models/index.js';
import type {
  SwigConfig,
  WalletCreateArgs,
  WalletCreateResult,
} from './types.js';

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

  createWallet = async (
    args: WalletCreateArgs,
  ): Promise<WalletCreateResult> => {
    const { data, error } = await this.#api.wallet.create(args);
    if (error || !data) {
      throw SwigError.fromApiError(error!);
    }
    return data;
  };
}
