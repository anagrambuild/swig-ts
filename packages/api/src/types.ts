export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(response: Response, body?: unknown): ApiError {
    const errorBody = body as Record<string, unknown> | undefined;
    const grpcMessage = response.headers.get('grpc-message');
    const grpcStatus = response.headers.get('grpc-status');
    const decodedGrpcMessage = grpcMessage
      ? decodeURIComponent(grpcMessage)
      : undefined;

    const nestedError = errorBody?.error as
      | { code?: string; message?: string }
      | undefined;
    if (nestedError && typeof nestedError === 'object') {
      const message =
        nestedError.message ??
        decodedGrpcMessage ??
        `Request failed with status ${response.status}`;
      const code = nestedError.code ?? grpcStatus ?? `HTTP_${response.status}`;
      return new ApiError(message, code, response.status, errorBody);
    }

    const message =
      (errorBody?.message as string) ||
      (errorBody?.error as string) ||
      decodedGrpcMessage ||
      `Request failed with status ${response.status}`;

    const code =
      (errorBody?.error_code as string) ||
      (errorBody?.code as string) ||
      grpcStatus ||
      `HTTP_${response.status}`;

    return new ApiError(message, code, response.status, errorBody?.details);
  }

  static fromException(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(error.message, 'NETWORK_ERROR', 0);
    }

    return new ApiError('An unknown error occurred', 'UNKNOWN_ERROR', 0);
  }
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

export interface SwigApiClientConfig {
  apiKey: string;
  portalUrl?: string;
  paymasterUrl?: string;
  retry?: RetryOptions;
}

export type Network = 'mainnet' | 'devnet';

export function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function err<T>(error: ApiError): ApiResponse<T> {
  return { data: null, error };
}
