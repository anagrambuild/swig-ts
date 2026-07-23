import { getBase58Codec } from '@solana/kit';
import { afterEach, describe, expect, test } from 'bun:test';
import { PaymasterClient } from '../src/client.js';
import { PaymasterError } from '../src/types.js';
import {
  createSerializedTransaction,
  createTipInstruction,
  createUnrelatedLookupInstruction,
  JITO_TIP_ADDRESS,
  LOOKUP_TABLE_ADDRESS,
  PAYMASTER_ADDRESS,
} from './fixtures.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('PaymasterClient.signAndSendBundleSerializedTransactions', () => {
  test('submits two prepared transactions unchanged and preserves signature order', async () => {
    const transactions = [
      createSerializedTransaction([createTipInstruction(400n)]),
      createSerializedTransaction([createTipInstruction(600n)]),
    ];
    let capturedBody: unknown;
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init);
      capturedBody = JSON.parse(await request.text());
      return new Response(
        JSON.stringify({
          request_id: 'request-1',
          bundle_id: 'bundle-1',
          signatures: ['signature-1', 'signature-2'],
          estimated_spent_by_paymaster: '11000',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;
    const client = createClient();

    const result = await client.signAndSendBundleSerializedTransactions(
      transactions,
      { idempotencyKey: 'bundle-key' },
    );

    expect(capturedBody).toEqual({
      base58_encoded_transactions: transactions.map((transaction) =>
        getBase58Codec().decode(transaction),
      ),
      network: 'mainnet',
      idempotencyKey: 'bundle-key',
    });
    expect(result).toEqual({
      requestId: 'request-1',
      bundleId: 'bundle-1',
      signatures: ['signature-1', 'signature-2'],
      estimatedSpentByPaymaster: 11_000n,
    });
  });

  test('rejects response signature cardinality mismatches', async () => {
    const transactions = createTwoTransactionBundle();
    const client = createClient();

    for (const signatures of [
      ['signature-1'],
      ['signature-1', 'signature-2', 'signature-3'],
    ]) {
      mockSponsorBundleResponse({ signatures });
      await expect(
        client.signAndSendBundleSerializedTransactions(transactions),
      ).rejects.toThrow(
        `Invalid sponsor bundle response: expected 2 signatures, received ${signatures.length}`,
      );
    }
  });

  test('rejects malformed required response fields', async () => {
    const transactions = createTwoTransactionBundle();
    const client = createClient();
    const cases: Array<{
      response: Record<string, unknown>;
      message: string;
    }> = [
      {
        response: { request_id: '' },
        message:
          'Invalid sponsor bundle response: request_id must be a non-empty string',
      },
      {
        response: { bundle_id: ' ' },
        message:
          'Invalid sponsor bundle response: bundle_id must be a non-empty string',
      },
      {
        response: { signatures: ['signature-1', 2] },
        message:
          'Invalid sponsor bundle response: signatures[1] must be a non-empty string',
      },
      {
        response: { estimated_spent_by_paymaster: '-1' },
        message:
          'Invalid sponsor bundle response: estimated_spent_by_paymaster must be a decimal u64 string',
      },
      {
        response: {
          estimated_spent_by_paymaster: '18446744073709551616',
        },
        message:
          'Invalid sponsor bundle response: estimated_spent_by_paymaster must be a decimal u64 string',
      },
    ];

    for (const { response, message } of cases) {
      mockSponsorBundleResponse(response);
      await expect(
        client.signAndSendBundleSerializedTransactions(transactions),
      ).rejects.toThrow(message);
    }
  });

  test('rejects an ALT-loaded paymaster instruction before making a request', async () => {
    const transactions = [
      createSerializedTransaction([createTipInstruction(1_000n)], {
        [LOOKUP_TABLE_ADDRESS]: [JITO_TIP_ADDRESS],
      }),
      createSerializedTransaction([createTipInstruction(1_000n)]),
    ];
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    }) as unknown as typeof fetch;
    const client = createClient();

    await expect(
      client.signAndSendBundleSerializedTransactions(transactions),
    ).rejects.toThrow(
      'Jito bundle transaction 0 contains an ALT-loaded instruction that references the paymaster',
    );
    expect(fetchCalled).toBe(false);
  });

  test('rejects an insufficiently tipped bundle before making a request', async () => {
    const transaction = createSerializedTransaction([
      createUnrelatedLookupInstruction(),
    ]);
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    }) as unknown as typeof fetch;
    const client = createClient();

    expect(
      client.signAndSendBundleSerializedTransactions([transaction]),
    ).rejects.toEqual(
      new PaymasterError(
        'Jito bundle must include at least 1000 lamports in recognized tip instructions',
      ),
    );
    expect(fetchCalled).toBe(false);
  });
});

function createClient(): PaymasterClient {
  return new PaymasterClient({
    apiKey: 'sk_test',
    paymasterPubkey: PAYMASTER_ADDRESS,
    baseUrl: 'http://localhost:8080',
    network: 'mainnet',
    retryOptions: {
      maxRetries: 0,
    },
  });
}

function createTwoTransactionBundle(): Uint8Array[] {
  return [
    createSerializedTransaction([createTipInstruction(400n)]),
    createSerializedTransaction([createTipInstruction(600n)]),
  ];
}

function mockSponsorBundleResponse(overrides: Record<string, unknown>): void {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        request_id: 'request-1',
        bundle_id: 'bundle-1',
        signatures: ['signature-1', 'signature-2'],
        estimated_spent_by_paymaster: '11000',
        ...overrides,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )) as unknown as typeof fetch;
}
