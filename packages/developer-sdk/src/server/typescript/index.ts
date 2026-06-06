import {
  DEFAULT_BACKEND_URL,
  HttpClient,
  resolveRetryOptions,
} from '../../core/index.js';
import { PaymasterClient } from '../../paymaster/index.js';
import { TransactionsClient } from '../../transactions/index.js';
import type { SwigClientConfig } from '../../types/index.js';
import { WalletsClient } from '../../wallets/index.js';

export class SwigClient {
  readonly #http: HttpClient;
  readonly defaultNetwork: SwigClientConfig['network'];
  readonly paymaster: PaymasterClient;
  readonly transactions: TransactionsClient;
  readonly wallets: WalletsClient;

  constructor(config: SwigClientConfig) {
    this.defaultNetwork = config.network;
    this.#http = new HttpClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BACKEND_URL,
      fetch: config.fetch ?? fetch,
      retry: resolveRetryOptions(config.retryOptions),
    });
    this.paymaster = new PaymasterClient(this.#http, this.defaultNetwork);
    this.transactions = new TransactionsClient(this.#http, this.defaultNetwork);
    this.wallets = new WalletsClient(this.#http, this.defaultNetwork);
  }
}
