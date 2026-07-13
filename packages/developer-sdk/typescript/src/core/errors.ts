export class SwigDeveloperSdkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SwigDeveloperSdkError';
  }

  static fromResponse(response: Response, body?: unknown) {
    const errorBody = body as Record<string, unknown> | undefined;
    const nestedError = errorBody?.error as
      | { code?: string; message?: string; details?: unknown }
      | undefined;

    if (nestedError && typeof nestedError === 'object') {
      return new SwigDeveloperSdkError(
        nestedError.message ?? `Request failed with status ${response.status}`,
        nestedError.code ?? `HTTP_${response.status}`,
        response.status,
        nestedError.details ?? errorBody,
      );
    }

    return new SwigDeveloperSdkError(
      (errorBody?.message as string | undefined) ??
        `Request failed with status ${response.status}`,
      (errorBody?.code as string | undefined) ?? `HTTP_${response.status}`,
      response.status,
      errorBody?.details ?? body,
    );
  }

  static fromException(error: unknown) {
    if (error instanceof SwigDeveloperSdkError) {
      return error;
    }

    if (error instanceof Error) {
      return new SwigDeveloperSdkError(error.message, 'NETWORK_ERROR', 0);
    }

    return new SwigDeveloperSdkError(
      'An unknown error occurred',
      'UNKNOWN_ERROR',
      0,
    );
  }
}
