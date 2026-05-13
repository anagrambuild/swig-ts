import { describe, expect, test } from 'bun:test';

import { SwigBrowserClient } from './browser.js';
import type { PreparedTransaction } from './types/index.js';

type CapturedRequest = {
  url: string;
  method?: string;
  headers: Headers;
  body: unknown;
};

function jsonFetch(
  handler: (request: CapturedRequest) => unknown,
): typeof fetch {
  return (async (input, init) => {
    const request = new Request(input, init);
    const text = await request.text();

    return new Response(
      JSON.stringify(
        handler({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: text ? JSON.parse(text) : undefined,
        }),
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;
}

describe('SwigBrowserClient', () => {
  test('prepares SOL transfers through an app proxy', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      baseUrl: 'https://app.example/api/swig',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            intentId: 'intent_transfer_123',
            transaction: 'base64-transfer-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            network: 'NETWORK_DEVNET',
            recentBlockhash: 'blockhash_456',
          },
        };
      }),
    });
    const wallet = swig.wallets.fromIdpSession({
      configAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterPubkey: 'requester_123',
    });

    const prepared = await wallet.transfer.prepareSol({
      destination: 'destination_123',
      amount: 42n,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/transfers/prepare',
      method: 'POST',
      body: {
        session: {
          configAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
          requesterPubkey: 'requester_123',
        },
        network: 'devnet',
        destination: 'destination_123',
        amountLamports: '42',
      },
    });
    expect(prepared).toMatchObject({
      intentId: 'intent_transfer_123',
      transaction: 'base64-transfer-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_456',
    });
  });

  test('signPrepared delegates to a client-side signer', async () => {
    const swig = new SwigBrowserClient();
    const prepared: PreparedTransaction = {
      intentId: 'intent_transfer_123',
      transaction: 'base64-transfer-tx',
      transactionEncoding: 'base64',
    };

    const signed = await swig.signing.signPrepared(prepared, {
      signer: {
        sign: async (transaction) => ({
          intentId: transaction.intentId,
          transaction: 'base64-signed-transfer-tx',
          transactionEncoding: transaction.transactionEncoding,
          network: transaction.network,
        }),
      },
    });

    expect(signed).toEqual({
      intentId: 'intent_transfer_123',
      transaction: 'base64-signed-transfer-tx',
      transactionEncoding: 'base64',
      network: undefined,
    });
  });
});
