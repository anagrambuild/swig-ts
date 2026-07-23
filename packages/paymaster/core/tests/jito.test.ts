import {
  address,
  appendTransactionMessageInstructions,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  pipe,
} from '@solana/kit';
import { describe, expect, test } from 'bun:test';
import { isPaymasterFeePayer } from '../src/helpers.js';
import {
  serializedBundleHasSufficientJitoTip,
  serializedTransactionJitoTipLamports,
  transactionMessageJitoTipLamports,
} from '../src/jito.js';
import {
  createSerializedLegacyTransaction,
  createSerializedTransaction,
  createTipInstruction,
  createUnrelatedLookupInstruction,
  JITO_TIP_ADDRESS,
  LOOKUP_ACCOUNT_ADDRESS,
  LOOKUP_TABLE_ADDRESS,
  PAYMASTER_ADDRESS,
} from './fixtures.js';

describe('serialized Jito bundle inspection', () => {
  test('reads a legacy fee payer from static accounts', () => {
    const transaction = createSerializedLegacyTransaction([
      createTipInstruction(1_000n),
    ]);

    expect(isPaymasterFeePayer(transaction, PAYMASTER_ADDRESS)).toBe(true);
    expect(isPaymasterFeePayer(transaction, LOOKUP_ACCOUNT_ADDRESS)).toBe(
      false,
    );
  });

  test('reads a v0 fee payer without resolving unrelated lookup accounts', () => {
    const transaction = createSerializedTransaction(
      [createUnrelatedLookupInstruction()],
      {
        [LOOKUP_TABLE_ADDRESS]: [LOOKUP_ACCOUNT_ADDRESS],
      },
    );

    expect(isPaymasterFeePayer(transaction, PAYMASTER_ADDRESS)).toBe(true);
    expect(
      serializedTransactionJitoTipLamports(transaction, PAYMASTER_ADDRESS),
    ).toBe(0n);
  });

  test('recognizes a static Jito tip', () => {
    const transaction = createSerializedTransaction([
      createTipInstruction(1_000n),
    ]);

    expect(
      serializedTransactionJitoTipLamports(transaction, PAYMASTER_ADDRESS),
    ).toBe(1_000n);
  });

  test('does not recognize an ALT-loaded Jito destination', () => {
    const transaction = createSerializedTransaction(
      [createTipInstruction(1_000n)],
      {
        [LOOKUP_TABLE_ADDRESS]: [JITO_TIP_ADDRESS],
      },
    );

    expect(
      serializedTransactionJitoTipLamports(transaction, PAYMASTER_ADDRESS),
    ).toBe(0n);
  });

  test('recognizes a static tip alongside an unrelated ALT instruction', () => {
    const transaction = createSerializedTransaction(
      [createTipInstruction(1_000n), createUnrelatedLookupInstruction()],
      {
        [LOOKUP_TABLE_ADDRESS]: [LOOKUP_ACCOUNT_ADDRESS],
      },
    );

    expect(isPaymasterFeePayer(transaction, PAYMASTER_ADDRESS)).toBe(true);
    expect(
      serializedTransactionJitoTipLamports(transaction, PAYMASTER_ADDRESS),
    ).toBe(1_000n);
    expect(
      serializedBundleHasSufficientJitoTip([transaction], PAYMASTER_ADDRESS),
    ).toBe(true);
  });

  test('requires at least 1,000 aggregate tip lamports', () => {
    const oneLamport = createSerializedTransaction([createTipInstruction(1n)]);
    const fiveHundredA = createSerializedTransaction([
      createTipInstruction(500n),
    ]);
    const fiveHundredB = createSerializedTransaction([
      createTipInstruction(500n),
    ]);

    expect(
      serializedBundleHasSufficientJitoTip([oneLamport], PAYMASTER_ADDRESS),
    ).toBe(false);
    expect(
      serializedBundleHasSufficientJitoTip(
        [fiveHundredA, fiveHundredB],
        PAYMASTER_ADDRESS,
      ),
    ).toBe(true);
  });
});

describe('transaction message Jito tip inspection', () => {
  test('does not recognize lookup-backed tip accounts before compilation', () => {
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (transactionMessage) =>
        appendTransactionMessageInstructions(
          [createTipInstruction(1_000n)],
          transactionMessage,
        ),
      (transactionMessage) =>
        compressTransactionMessageUsingAddressLookupTables(transactionMessage, {
          [address(LOOKUP_TABLE_ADDRESS)]: [address(JITO_TIP_ADDRESS)],
        }),
    );

    expect(transactionMessageJitoTipLamports(message, PAYMASTER_ADDRESS)).toBe(
      0n,
    );
  });
});
