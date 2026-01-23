import type { ApiError } from '@swig-wallet/api';

export class SwigError extends Error {
  constructor(
    message: string,
    /** Machine-readable error code (e.g., 'INVALID_API_KEY', 'NETWORK_ERROR') */
    public readonly code: string,
    /** HTTP status code if from an API request */
    public readonly statusCode?: number,
    /** Raw response data from the failed request */
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = 'SwigError';
  }

  /** Creates a SwigError from an HTTP response. */
  static fromResponse = (response: Response, body?: unknown): SwigError => {
    const parsed = body as Record<string, unknown> | undefined;

    const message =
      (parsed?.message as string) ||
      (parsed?.error as string) ||
      `Request failed with status ${response.status}`;

    const code =
      (parsed?.error_code as string) ||
      (parsed?.code as string) ||
      `HTTP_${response.status}`;

    return new SwigError(message, code, response.status, body);
  };

  /** Creates a SwigError from a caught exception. */
  static fromException = (error: unknown): SwigError => {
    if (error instanceof SwigError) {
      return error;
    }

    if (error instanceof Error) {
      return new SwigError(error.message, 'NETWORK_ERROR', undefined, error);
    }

    return new SwigError(String(error), 'UNKNOWN_ERROR', undefined, error);
  };

  /** Creates a SwigError from an ApiError. */
  static fromApiError = (error: ApiError): SwigError => {
    return new SwigError(
      error.message,
      error.code,
      error.status,
      error.details,
    );
  };
}
