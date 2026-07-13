import bs58 from 'bs58';
import { describe, expect, test } from 'bun:test';

import { TransactionsClient } from './client.js';

describe('TransactionsClient', () => {
  test('sponsors base64 transactions through the deployed paymaster endpoint', async () => {
    const transactionBytes = Uint8Array.from([1, 2, 3, 4, 5]);
    const calls: Array<{ path: string; body: unknown }> = [];
    const transactions = new TransactionsClient(
      {
        post: async (path: string, body: unknown) => {
          calls.push({ path, body });
          return { signature: 'sponsored_signature_123' };
        },
      } as never,
      'devnet',
    );

    await expect(
      transactions.sponsor({
        transaction: bytesToBase64(transactionBytes),
        idempotencyKey: 'sponsor-request-123',
      }),
    ).resolves.toEqual({
      signature: 'sponsored_signature_123',
    });

    expect(calls).toEqual([
      {
        path: '/paymaster/sponsor',
        body: {
          base58_encoded_transaction: bs58.encode(transactionBytes),
          network: 'devnet',
          idempotencyKey: 'sponsor-request-123',
        },
      },
    ]);
  });
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
