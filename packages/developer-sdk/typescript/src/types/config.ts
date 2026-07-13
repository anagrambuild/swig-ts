import type { Network } from './common.js';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

export interface SwigClientConfig {
  apiKey: string;
  /**
   * Backend API base URL. Defaults to https://backend.prod.infra.onswig.com.
   */
  baseUrl?: string;
  /**
   * Optional default network for wallet operations.
   */
  network?: Network;
  retryOptions?: RetryOptions;
  fetch?: typeof fetch;
}
