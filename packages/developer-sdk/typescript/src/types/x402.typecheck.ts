import type {
  PaymentPayloadV2 as CorePaymentPayloadV2,
  PaymentRequiredV2 as CorePaymentRequiredV2,
} from '@x402/core/schemas';

import type { PaymentPayloadV2, PaymentRequiredV2 } from './x402.js';

declare const corePaymentRequired: CorePaymentRequiredV2;
declare const sdkPaymentRequired: PaymentRequiredV2;

const sdkPaymentRequiredFromCore: PaymentRequiredV2 = corePaymentRequired;
const corePaymentRequiredFromSdk: CorePaymentRequiredV2 = sdkPaymentRequired;

declare const corePaymentPayload: CorePaymentPayloadV2;
declare const sdkPaymentPayload: PaymentPayloadV2;

const sdkPaymentPayloadFromCore: PaymentPayloadV2 = corePaymentPayload;
const corePaymentPayloadFromSdk: CorePaymentPayloadV2 = sdkPaymentPayload;

void [
  sdkPaymentRequiredFromCore,
  corePaymentRequiredFromSdk,
  sdkPaymentPayloadFromCore,
  corePaymentPayloadFromSdk,
];
