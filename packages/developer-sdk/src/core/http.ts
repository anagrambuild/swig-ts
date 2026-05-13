import type { RetryOptions } from '../types/index.js';
import { SwigDeveloperSdkError } from './errors.js';

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  retry: Required<RetryOptions>;
  fetch: typeof fetch;
}

export class HttpClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #retry: Required<RetryOptions>;
  readonly #fetch: typeof fetch;

  constructor(config: HttpClientConfig) {
    this.#apiKey = config.apiKey;
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#retry = config.retry;
    this.#fetch = config.fetch;
  }

  post = async <TResponse>(path: string, body: unknown): Promise<TResponse> => {
    return this.#request<TResponse>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  #request = async <TResponse>(
    path: string,
    init: RequestInit,
  ): Promise<TResponse> => {
    let lastError: SwigDeveloperSdkError | undefined;
    let attempt = 0;

    while (attempt <= this.#retry.maxRetries) {
      try {
        const response = await this.#fetch(`${this.#baseUrl}${path}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.#apiKey}`,
            ...init.headers,
          },
        });

        const body = await parseResponseBody(response);

        if (!response.ok) {
          const error = SwigDeveloperSdkError.fromResponse(response, body);
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          lastError = error;
        } else {
          return unwrapData<TResponse>(body);
        }
      } catch (error) {
        const sdkError = SwigDeveloperSdkError.fromException(error);
        if (sdkError.statusCode >= 400 && sdkError.statusCode < 500) {
          throw sdkError;
        }
        lastError = sdkError;
      }

      attempt++;

      if (attempt <= this.#retry.maxRetries) {
        await wait(
          this.#retry.retryDelay *
            Math.pow(this.#retry.backoffMultiplier, attempt - 1),
        );
      }
    }

    throw (
      lastError ??
      new SwigDeveloperSdkError(
        `Request failed after ${this.#retry.maxRetries} retries`,
        'RETRY_EXHAUSTED',
        0,
      )
    );
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapData<TResponse>(body: unknown): TResponse {
  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as { data: TResponse }).data;
  }
  return body as TResponse;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
