import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import { createPaymasterClient } from '../src/index.js';

const PAYMASTER_ADDRESS = 'Ac2z6B25qv5rHprsMi7mcGo1LgkJ5kdxaUejxFcKGxZS';
const MEMO_PROGRAM_ADDRESS = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const TEST_BLOCKHASH = '11111111111111111111111111111111';

describe('PaymasterClient.prepareJitoBundleTransactions', () => {
  test('adds a tip before signing', () => {
    const client = createClient();
    const transaction = createTransaction(32);

    const prepared = client.prepareJitoBundleTransactions([transaction], {
      tipLamports: 1_000,
    });

    expect(prepared).toBeArrayOfSize(1);
    expect(prepared[0]).toBe(transaction);
    expect(transaction.instructions).toBeArrayOfSize(2);
  });

  test('restores the transaction when the tip does not fit', () => {
    const client = createClient();
    const transaction = createTransactionAtTipSizeBoundary(client);
    const originalInstruction = transaction.instructions[0];

    expect(() =>
      client.prepareJitoBundleTransactions([transaction], {
        tipLamports: 1_000,
      }),
    ).toThrow('Unable to fit Jito tip instruction in the last transaction');

    expect(transaction.instructions).toEqual([originalInstruction]);
  });
});

function createClient() {
  return createPaymasterClient({
    apiKey: 'sk_test',
    paymasterPubkey: PAYMASTER_ADDRESS,
    baseUrl: 'http://localhost:8080',
    network: 'mainnet',
  });
}

function createTransaction(dataLength: number): Transaction {
  return new Transaction({
    feePayer: new PublicKey(PAYMASTER_ADDRESS),
    recentBlockhash: TEST_BLOCKHASH,
  }).add(
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM_ADDRESS),
      keys: [],
      data: Buffer.alloc(dataLength, 1),
    }),
  );
}

function createTransactionAtTipSizeBoundary(
  client: ReturnType<typeof createClient>,
): Transaction {
  for (let dataLength = 900; dataLength <= 1_100; dataLength++) {
    const transaction = createTransaction(dataLength);
    try {
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    } catch {
      continue;
    }

    const candidate = createTransaction(dataLength);
    candidate.add(client.createJitoTipInstruction({ tipLamports: 1_000 }));
    try {
      candidate.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    } catch {
      return transaction;
    }
  }

  throw new Error('Unable to construct a transaction at the tip size boundary');
}
