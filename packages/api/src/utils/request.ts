import {
  ApiError,
  err,
  ok,
  type ApiResponse,
  type RetryOptions,
} from '../types.js';

/**
 * Makes an HTTP request with retry logic and exponential backoff.
 * Retries on 5xx errors and network failures. Does NOT retry on 4xx errors.
 */
export async function request<T>(
  url: string,
  options: RequestInit,
  retry: Required<RetryOptions>,
): Promise<ApiResponse<T>> {
  let lastError: ApiError | undefined;
  let attempt = 0;

  while (attempt <= retry.maxRetries) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = await response.text().catch(() => undefined);
        }

        const error = ApiError.fromResponse(response, body);

        if (response.status >= 400 && response.status < 500) {
          return err(error);
        }

        lastError = error;
      } else {
        const body = await response.json();
        if (body !== null && typeof body === 'object' && 'data' in body) {
          return ok(body.data as T);
        }
        return ok(body as T);
      }
    } catch (error) {
      lastError = ApiError.fromException(error);
    }

    attempt++;

    if (attempt <= retry.maxRetries) {
      const delay =
        retry.retryDelay * Math.pow(retry.backoffMultiplier, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return err(
    lastError ??
      new ApiError(
        `Request failed after ${retry.maxRetries} retries`,
        'RETRY_EXHAUSTED',
        0,
      ),
  );
}
