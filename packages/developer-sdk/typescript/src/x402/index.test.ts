import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
} from '@x402/core/http';
import {
  PaymentPayloadV2Schema,
  PaymentRequiredV2Schema,
  type PaymentPayloadV2 as CorePaymentPayloadV2,
  type PaymentRequiredV2 as CorePaymentRequiredV2,
} from '@x402/core/schemas';
import type { PaymentRequired } from '@x402/core/types';
import { describe, expect, test } from 'bun:test';

import { signPreparedTransaction } from '../client/index.js';
import type {
  PaymentPayloadV2,
  PaymentRequiredV2,
  PreparedTransaction,
  X402PreparationResult,
} from '../types/index.js';
import {
  createX402Payment,
  normalizeX402PreparationResponse,
  parsePaymentRequiredFromResponse,
} from './index.js';

const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

describe('public x402 types', () => {
  test('remain compatible with the pinned official schema output', () => {
    const corePaymentRequired: CorePaymentRequiredV2 =
      PaymentRequiredV2Schema.parse(paymentRequiredFixture());
    const sdkPaymentRequired: PaymentRequiredV2 = corePaymentRequired;
    const corePaymentRequiredAgain: CorePaymentRequiredV2 = sdkPaymentRequired;

    const corePaymentPayload: CorePaymentPayloadV2 =
      PaymentPayloadV2Schema.parse({
        x402Version: 2,
        resource: sdkPaymentRequired.resource,
        accepted: sdkPaymentRequired.accepts[0],
        payload: { transaction: bytesToBase64(Uint8Array.of(1)) },
      });
    const sdkPaymentPayload: PaymentPayloadV2 = corePaymentPayload;
    const corePaymentPayloadAgain: CorePaymentPayloadV2 = sdkPaymentPayload;

    expect(corePaymentRequiredAgain).toEqual(corePaymentRequired);
    expect(corePaymentPayloadAgain).toEqual(corePaymentPayload);
  });
});

describe('parsePaymentRequiredFromResponse', () => {
  test('requires a 402 response with a PAYMENT-REQUIRED header', () => {
    expect(() => parsePaymentRequiredFromResponse(new Response(null))).toThrow(
      'status 402',
    );
    expect(() =>
      parsePaymentRequiredFromResponse(new Response(null, { status: 402 })),
    ).toThrow('missing PAYMENT-REQUIRED');
    expect(() =>
      parsePaymentRequiredFromResponse(
        new Response(null, {
          status: 402,
          headers: { 'PAYMENT-REQUIRED': 'not-base64' },
        }),
      ),
    ).toThrow('not valid x402 data');
  });

  test('decodes and validates an official PAYMENT-REQUIRED header', () => {
    const paymentRequired = paymentRequiredFixture();
    const response = paymentRequiredResponse(paymentRequired);

    expect(parsePaymentRequiredFromResponse(response)).toEqual(
      PaymentRequiredV2Schema.parse(paymentRequired),
    );
  });

  test('rejects decoded data that does not match the x402 V2 schema', () => {
    const response = paymentRequiredResponse({
      ...paymentRequiredFixture(),
      resource: { description: 'missing required URL' },
    });

    expect(() => parsePaymentRequiredFromResponse(response)).toThrow(
      'PAYMENT-REQUIRED does not match the x402 v2 schema',
    );
  });

  test('returns schema-normalized data while preserving nested extra and extensions values', () => {
    const input = {
      ...paymentRequiredFixture(),
      error: null,
      resource: {
        url: 'https://merchant.example/resource',
        description: null,
        tags: null,
        unknownResourceField: { correlation: 'resource-1' },
      },
      accepts: [
        {
          ...paymentRequiredFixture().accepts[0],
          extra: {
            feePayer: '11111111111111111111111111111111',
            merchantExtraData: { correlation: 'requirement-1' },
          },
          unknownRequirementField: { keep: true },
        },
      ],
      extensions: {
        merchantExtension: { enabled: true },
      },
      unknownEnvelopeField: { keep: true },
    };
    const parsed = parsePaymentRequiredFromResponse(
      paymentRequiredResponse(input),
    );

    expect(parsed).toEqual(PaymentRequiredV2Schema.parse(input));
    expect(parsed.error).toBeUndefined();
    expect(parsed.resource.description).toBeUndefined();
    expect(parsed.resource.tags).toBeUndefined();
    expect(Object.hasOwn(parsed.resource, 'unknownResourceField')).toBe(false);
    expect(Object.hasOwn(parsed.accepts[0]!, 'unknownRequirementField')).toBe(
      false,
    );
    expect(Object.hasOwn(parsed, 'unknownEnvelopeField')).toBe(false);
    expect(parsed.accepts[0]?.extra).toEqual({
      feePayer: '11111111111111111111111111111111',
      merchantExtraData: { correlation: 'requirement-1' },
    });
    expect(parsed.extensions).toEqual({
      merchantExtension: { enabled: true },
    });
  });

  test.each([
    { label: 'omitted', present: false, value: undefined },
    { label: 'null', present: true, value: null },
    { label: 'empty object', present: true, value: {} },
    {
      label: 'populated object',
      present: true,
      value: { merchantData: { correlation: 'merchant-1' } },
    },
  ] as const)(
    'preserves $label extra and extensions presence',
    ({ present, value }) => {
      const paymentRequired: PaymentRequiredV2 = {
        x402Version: 2,
        resource: paymentRequiredFixture().resource,
        accepts: [
          {
            ...paymentRequirementFixture(),
            ...(present ? { extra: value } : {}),
          },
        ],
        ...(present ? { extensions: value } : {}),
      };
      const parsed = parsePaymentRequiredFromResponse(
        paymentRequiredResponse(paymentRequired),
      );

      expect(Object.hasOwn(parsed.accepts[0]!, 'extra')).toBe(present);
      expect(Object.hasOwn(parsed, 'extensions')).toBe(present);
      if (present) {
        expect(parsed.accepts[0]?.extra).toEqual(value);
        expect(parsed.extensions).toEqual(value);
      }
    },
  );
});

describe('createX402Payment', () => {
  test('accepts output from the existing generic transaction signer', async () => {
    const prepared = preparationFixture(paymentRequiredFixture());
    const signedTransaction = bytesToBase64(Uint8Array.of(1, 2, 3));
    const signed = await signPreparedTransaction(prepared.preparedTransaction, {
      signTransaction: async () => signedTransaction,
    });

    expect(
      createX402Payment(prepared, signed).paymentPayload.payload.transaction,
    ).toBe(signedTransaction);
  });

  test('returns a payload and an official PAYMENT-SIGNATURE header round-trip', () => {
    const paymentRequiredInput = {
      ...paymentRequiredFixture(),
      resource: {
        ...paymentRequiredFixture().resource,
        description: null,
        unknownResourceField: { strip: true },
      },
      accepts: [
        {
          ...paymentRequiredFixture().accepts[0]!,
          unknownRequirementField: { strip: true },
        },
      ],
      unknownEnvelopeField: { strip: true },
    };
    const prepared = preparationFixture(paymentRequiredInput);
    const signedTransaction = bytesToBase64(Uint8Array.of(1, 2, 3, 4));

    const submission = createX402Payment(prepared, {
      transaction: signedTransaction,
      transactionEncoding: 'base64',
      network: 'devnet',
    });
    const normalizedPaymentRequired =
      PaymentRequiredV2Schema.parse(paymentRequiredInput);
    const expectedPayload = PaymentPayloadV2Schema.parse({
      x402Version: 2,
      resource: normalizedPaymentRequired.resource,
      accepted: normalizedPaymentRequired.accepts[0],
      payload: { transaction: signedTransaction },
    });

    expect(submission.paymentPayload).toEqual(expectedPayload);
    expect(submission.paymentPayload.resource?.description).toBeUndefined();
    expect(
      Object.hasOwn(
        submission.paymentPayload.resource ?? {},
        'unknownResourceField',
      ),
    ).toBe(false);
    expect(
      Object.hasOwn(
        submission.paymentPayload.accepted,
        'unknownRequirementField',
      ),
    ).toBe(false);
    expect(Object.hasOwn(submission.paymentPayload, 'extensions')).toBe(false);
    expect(
      decodePaymentSignatureHeader(
        submission.paymentSignatureHeaders['PAYMENT-SIGNATURE'],
      ) as unknown,
    ).toEqual(JSON.parse(JSON.stringify(submission.paymentPayload)));
  });

  test.each([
    { label: 'null', value: null },
    { label: 'empty object', value: {} },
    {
      label: 'populated object',
      value: { merchantExtension: { enabled: true } },
    },
  ] as const)(
    'preserves $label extensions in the payload and header',
    ({ value }) => {
      const paymentRequired = {
        ...paymentRequiredFixture(),
        extensions: value,
      };
      const submission = createX402Payment(
        preparationFixture(paymentRequired),
        {
          transaction: bytesToBase64(Uint8Array.of(1)),
          transactionEncoding: 'base64',
          network: 'devnet',
        },
      );
      const normalizedPaymentRequired =
        PaymentRequiredV2Schema.parse(paymentRequired);
      const expectedPayload = PaymentPayloadV2Schema.parse({
        x402Version: 2,
        resource: normalizedPaymentRequired.resource,
        accepted: normalizedPaymentRequired.accepts[0],
        payload: { transaction: bytesToBase64(Uint8Array.of(1)) },
        extensions: value,
      });

      expect(submission.paymentPayload).toEqual(expectedPayload);
      expect(Object.hasOwn(submission.paymentPayload, 'extensions')).toBe(true);
      expect(submission.paymentPayload.extensions).toEqual(value);
      expect(
        decodePaymentSignatureHeader(
          submission.paymentSignatureHeaders['PAYMENT-SIGNATURE'],
        ) as unknown,
      ).toEqual(submission.paymentPayload);
    },
  );

  test.each(['AQ', 'AQ==\n', 'AQ-_'])(
    'rejects non-canonical Base64 transaction %s',
    (transaction) => {
      expect(() =>
        createX402Payment(preparationFixture(paymentRequiredFixture()), {
          transaction,
          transactionEncoding: 'base64',
          network: 'devnet',
        }),
      ).toThrow('signed x402 transaction is not canonical base64');
    },
  );

  test('rejects a signed transaction for a different network', () => {
    expect(() =>
      createX402Payment(preparationFixture(paymentRequiredFixture()), {
        transaction: bytesToBase64(Uint8Array.of(1)),
        transactionEncoding: 'base64',
        network: 'mainnet',
      }),
    ).toThrow('signed x402 transaction has a different network');
  });

  test('accepts 1,232 transaction bytes and rejects 1,233 bytes', () => {
    const prepared = preparationFixture(paymentRequiredFixture());

    expect(() =>
      createX402Payment(prepared, {
        transaction: bytesToBase64(new Uint8Array(1_232).fill(1)),
        transactionEncoding: 'base64',
        network: 'devnet',
      }),
    ).not.toThrow();

    expect(() =>
      createX402Payment(prepared, {
        transaction: bytesToBase64(new Uint8Array(1_233).fill(1)),
        transactionEncoding: 'base64',
        network: 'devnet',
      }),
    ).toThrow('signed x402 transaction exceeds the Solana wire limit');
  });

  test('rejects an encoded PAYMENT-SIGNATURE value over 8,000 bytes', () => {
    const paymentRequired = {
      ...paymentRequiredFixture(),
      extensions: {
        merchantMetadata: 'x'.repeat(7_000),
      },
    };

    expect(() =>
      createX402Payment(preparationFixture(paymentRequired), {
        transaction: bytesToBase64(Uint8Array.of(1)),
        transactionEncoding: 'base64',
        network: 'devnet',
      }),
    ).toThrow('PAYMENT-SIGNATURE exceeds the supported header size');
  });
});

describe('normalizeX402PreparationResponse', () => {
  test('requires the backend-selected index, including explicit zero presence', () => {
    const paymentRequired = parsePaymentRequiredFromResponse(
      paymentRequiredResponse(paymentRequiredFixture()),
    );

    expect(() =>
      normalizeX402PreparationResponse(
        { preparedTransaction: preparedTransactionWire() },
        paymentRequired,
        undefined,
        'devnet',
        'swig_config_123',
      ),
    ).toThrow('invalid acceptedIndex');

    expect(
      normalizeX402PreparationResponse(
        {
          preparedTransaction: preparedTransactionWire(),
          acceptedIndex: 0,
        },
        paymentRequired,
        undefined,
        'devnet',
        'swig_config_123',
      ).acceptedIndex,
    ).toBe(0);
  });

  test('rejects mismatched transaction metadata', () => {
    const paymentRequired = parsePaymentRequiredFromResponse(
      paymentRequiredResponse(paymentRequiredFixture()),
    );

    expect(() =>
      normalizeX402PreparationResponse(
        {
          preparedTransaction: {
            ...preparedTransactionWire(),
            kind: 'PREPARED_TRANSACTION_KIND_ADD_AUTHORITY',
          },
          acceptedIndex: 0,
        },
        paymentRequired,
        undefined,
        'devnet',
        'swig_config_123',
      ),
    ).toThrow('invalid transaction kind');

    expect(() =>
      normalizeX402PreparationResponse(
        {
          preparedTransaction: {
            ...preparedTransactionWire(),
            network: 'NETWORK_MAINNET',
          },
          acceptedIndex: 0,
        },
        paymentRequired,
        undefined,
        'devnet',
        'swig_config_123',
      ),
    ).toThrow('different network');
  });
});

function paymentRequiredFixture(): PaymentRequiredV2 {
  return {
    x402Version: 2,
    resource: {
      url: 'https://merchant.example/resource',
      description: 'A protected resource',
      mimeType: 'application/json',
    },
    accepts: [
      {
        ...paymentRequirementFixture(),
        extra: {
          feePayer: '11111111111111111111111111111111',
        },
      },
    ],
  };
}

function paymentRequirementFixture(): PaymentRequiredV2['accepts'][number] {
  return {
    scheme: 'exact',
    network: DEVNET,
    amount: '1000',
    asset: 'So11111111111111111111111111111111111111112',
    payTo: '11111111111111111111111111111111',
    maxTimeoutSeconds: 300,
  };
}

function paymentRequiredResponse(value: unknown): Response {
  return new Response(null, {
    status: 402,
    headers: {
      'PAYMENT-REQUIRED': encodePaymentRequiredHeader(
        value as unknown as PaymentRequired,
      ),
    },
  });
}

function preparationFixture(
  paymentRequired: PaymentRequiredV2 | unknown,
): X402PreparationResult {
  const preparedTransaction: PreparedTransaction = {
    transaction: bytesToBase64(Uint8Array.of(0)),
    transactionEncoding: 'base64',
    network: 'devnet',
    kind: 'x402-payment',
    signatureRequests: [],
  };

  return {
    preparedTransaction,
    paymentRequired:
      paymentRequired as X402PreparationResult['paymentRequired'],
    acceptedIndex: 0,
  };
}

function preparedTransactionWire() {
  return {
    transaction: 'AQ==',
    transactionEncoding: 'TRANSACTION_ENCODING_BASE64' as const,
    network: 'NETWORK_DEVNET' as const,
    kind: 'PREPARED_TRANSACTION_KIND_X402_PAYMENT' as const,
    wallet: {
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
