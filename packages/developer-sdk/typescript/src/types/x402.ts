import type { PreparedTransaction } from './transaction.js';

export interface X402ResourceInfoV2 {
  url: string;
  description?: string | undefined;
  mimeType?: string | undefined;
  serviceName?: string | undefined;
  tags?: string[] | undefined;
  iconUrl?: string | undefined;
}

export interface X402PaymentRequirementV2 {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown> | null | undefined;
}

export interface PaymentRequiredV2 {
  x402Version: 2;
  error?: string | undefined;
  resource: X402ResourceInfoV2;
  accepts: X402PaymentRequirementV2[];
  extensions?: Record<string, unknown> | null | undefined;
}

export interface PaymentPayloadV2 {
  x402Version: 2;
  resource?: X402ResourceInfoV2 | undefined;
  accepted: X402PaymentRequirementV2;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown> | null | undefined;
}

export interface PrepareX402PaymentOptions {
  acceptedIndex?: number;
}

export interface X402PreparationResult {
  preparedTransaction: PreparedTransaction;
  paymentRequired: PaymentRequiredV2;
  acceptedIndex: number;
}

export interface X402PaymentSubmission {
  paymentPayload: PaymentPayloadV2;
  paymentSignatureHeaders: Record<'PAYMENT-SIGNATURE', string>;
}

export interface WalletX402Client {
  prepareFromResponse(
    response: Response,
    options?: PrepareX402PaymentOptions,
  ): Promise<X402PreparationResult>;
}
