import { describe, expect, test } from 'bun:test';

import {
  normalizeAmount,
  normalizeInstruction,
  normalizePreparedTransaction,
  normalizeSubmittedTransaction,
} from './normalizers.js';

describe('wallet normalizers', () => {
  test('normalizes snake_case prepared transaction responses', () => {
    expect(
      normalizePreparedTransaction({
        intent_id: 'intent_123',
        unsigned_transaction: 'base64-tx',
        transaction_encoding: 'TRANSACTION_ENCODING_BASE64',
        network: 'NETWORK_DEVNET',
        recent_blockhash: 'blockhash_123',
      }),
    ).toEqual({
      intentId: 'intent_123',
      transaction: 'base64-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_123',
    });
  });

  test('normalizes instruction account defaults and byte data', () => {
    expect(
      normalizeInstruction({
        programId: 'program_123',
        accounts: [{ pubkey: 'account_123' }],
        data: new Uint8Array([1, 2, 3]),
      }),
    ).toEqual({
      programId: 'program_123',
      accounts: [
        {
          pubkey: 'account_123',
          isSigner: false,
          isWritable: false,
        },
      ],
      data: 'AQID',
    });
  });

  test('serializes numeric amounts as strings', () => {
    expect(normalizeAmount(1_000_000n)).toBe('1000000');
    expect(normalizeAmount('2500')).toBe('2500');
  });

  test('normalizes sponsored submission responses', () => {
    expect(
      normalizeSubmittedTransaction({
        intent_id: 'intent_123',
        signature: 'signature_123',
        status: 'submitted',
      }),
    ).toEqual({
      intentId: 'intent_123',
      signature: 'signature_123',
      status: 'submitted',
    });
  });
});
