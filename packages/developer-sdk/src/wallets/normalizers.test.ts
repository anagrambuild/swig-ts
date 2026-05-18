import { describe, expect, test } from 'bun:test';

import {
  normalizeAmount,
  normalizeCreateWalletResponse,
  normalizeInstruction,
  normalizePreparedTransaction,
  normalizeSubmittedTransaction,
} from './normalizers.js';

describe('wallet normalizers', () => {
  test('normalizes snake_case prepared transaction responses', () => {
    expect(
      normalizePreparedTransaction({
        unsigned_transaction: 'base64-tx',
        transaction_encoding: 'TRANSACTION_ENCODING_BASE64',
        network: 'NETWORK_DEVNET',
        recent_blockhash: 'blockhash_123',
      }),
    ).toEqual({
      transaction: 'base64-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_123',
    });
  });

  test('normalizes create wallet responses with multiple prepared transactions', () => {
    expect(
      normalizeCreateWalletResponse({
        wallet: {
          swigConfigAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
        },
        transactions: [
          {
            transaction: 'base64-create-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
          },
          {
            transaction: 'base64-add-authority-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            kind: 'PREPARED_TRANSACTION_KIND_ADD_AUTHORITY',
          },
        ],
        addAuthorityChallenge: {
          transactionIndex: 1,
          scheme: 'AUTHORITY_SIGNATURE_SCHEME_SECP256R1',
          signer: 'compressed-passkey',
          messageHash: 'message-hash',
          slot: '42',
          counter: 1,
        },
        network: 'NETWORK_DEVNET',
      }),
    ).toEqual({
      wallet: {
        swigConfigAddress: 'swig_config_123',
        walletAddress: 'wallet_123',
      },
      creationTransaction: {
        transaction: 'base64-create-tx',
        transactionEncoding: 'base64',
        kind: 'create-swig-wallet',
        network: 'devnet',
      },
      transactions: [
        {
          transaction: 'base64-create-tx',
          transactionEncoding: 'base64',
          kind: 'create-swig-wallet',
          network: 'devnet',
        },
        {
          transaction: 'base64-add-authority-tx',
          transactionEncoding: 'base64',
          kind: 'add-authority',
          network: 'devnet',
        },
      ],
      addAuthorityChallenge: {
        transactionIndex: 1,
        scheme: 'secp256r1',
        signer: 'compressed-passkey',
        messageHash: 'message-hash',
        slot: 42,
        counter: 1,
      },
      network: 'devnet',
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
        signature: 'signature_123',
        status: 'submitted',
      }),
    ).toEqual({
      signature: 'signature_123',
      status: 'submitted',
    });
  });
});
