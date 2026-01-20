import { PaymasterApi } from './paymaster/client.js';
import { PoliciesApi } from './portal/policies.js';
import { WalletApi } from './portal/wallet.js';
import type { RetryOptions, SwigApiClientConfig } from './types.js';

export class SwigApiClient {
  public apiKey: string;
  public portalUrl: string;
  public paymasterUrl: string;
  public retry: Required<RetryOptions>;

  public readonly policies: PoliciesApi;
  public readonly wallet: WalletApi;
  public readonly paymaster: PaymasterApi;

  constructor(config: SwigApiClientConfig) {
    this.apiKey = config.apiKey;
    this.portalUrl = (
      config.portalUrl ?? 'https://dashboard.onswig.com'
    ).replace(/\/$/, '');
    this.paymasterUrl = (
      config.paymasterUrl ?? 'https://api.onswig.com'
    ).replace(/\/$/, '');
    this.retry = {
      maxRetries: config.retry?.maxRetries ?? 3,
      retryDelay: config.retry?.retryDelay ?? 1000,
      backoffMultiplier: config.retry?.backoffMultiplier ?? 2,
    };

    this.policies = new PoliciesApi(this);
    this.wallet = new WalletApi(this);
    this.paymaster = new PaymasterApi(this);
  }
}
