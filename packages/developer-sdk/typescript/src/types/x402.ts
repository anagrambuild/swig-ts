import type { PaymentPayloadV2, PaymentRequiredV2 } from '@x402/core/schemas';
import type { PreparedTransaction } from './transaction.js';

export type { PaymentPayloadV2, PaymentRequiredV2 } from '@x402/core/schemas';

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
