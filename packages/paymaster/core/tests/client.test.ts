import { getBase58Codec } from '@solana/kit';
import { afterEach, describe, expect, test } from 'bun:test';
import { PaymasterClient } from '../src/client.js';
import { PaymasterError } from '../src/types.js';
import {
  createSerializedTransaction,
  createTipInstruction,
  createUnrelatedLookupInstruction,
  PAYMASTER_ADDRESS,
} from './fixtures.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('PaymasterClient.signAndSendBundleSerializedTransactions', () => {
  test('submits the prepared bundle unchanged and maps estimated spend', async () => {
    const transaction = createSerializedTransaction([
      createTipInstruction(1_000n),
    ]);
    let capturedBody: unknown;
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init);
      capturedBody = JSON.parse(await request.text());
      return new Response(
        JSON.stringify({
          request_id: 'request-1',
          bundle_id: 'bundle-1',
          signatures: ['signature-1'],
          estimated_spent_by_paymaster: '6000',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;
    const client = createClient();

    const result = await client.signAndSendBundleSerializedTransactions(
      [transaction],
      { idempotencyKey: 'bundle-key' },
    );

    expect(capturedBody).toEqual({
      base58_encoded_transactions: [getBase58Codec().decode(transaction)],
      network: 'mainnet',
      idempotencyKey: 'bundle-key',
    });
    expect(result).toEqual({
      requestId: 'request-1',
      bundleId: 'bundle-1',
      signatures: ['signature-1'],
      estimatedSpentByPaymaster: 6_000n,
    });
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
