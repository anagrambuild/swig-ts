import { describe, expect, test } from 'bun:test';

import type { PreparedTransaction } from '../types/index.js';
import { signPreparedTransaction } from './index.js';

const prepared: PreparedTransaction = {
  intentId: 'intent_123',
  transaction: 'base64-prepared-tx',
  transactionEncoding: 'base64',
  network: 'devnet',
};

describe('client signing helpers', () => {
  test('signPreparedTransaction signs the transaction and preserves intent metadata', async () => {
    await expect(
      signPreparedTransaction(prepared, {
        signTransaction: async (transaction) => `${transaction}.signed`,
      }),
    ).resolves.toEqual({
      intentId: 'intent_123',
      transaction: 'base64-prepared-tx.signed',
      transactionEncoding: 'base64',
      network: 'devnet',
    });
  });
});
