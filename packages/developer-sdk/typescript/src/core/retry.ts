import type { RetryOptions } from '../types/index.js';
import { DEFAULT_RETRY_OPTIONS } from './constants.js';

export function resolveRetryOptions(
  retryOptions?: RetryOptions,
): Required<RetryOptions> {
  return {
    maxRetries: retryOptions?.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries,
    retryDelay: retryOptions?.retryDelay ?? DEFAULT_RETRY_OPTIONS.retryDelay,
    backoffMultiplier:
      retryOptions?.backoffMultiplier ??
      DEFAULT_RETRY_OPTIONS.backoffMultiplier,
  };
}
