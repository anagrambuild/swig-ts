import { describe, expect, test } from 'bun:test';

import { createSwigRouteHandlers } from './next.js';

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

describe('createSwigRouteHandlers', () => {
  test('prepares SOL transfers through the API-key server client', async () => {
    const calls: CapturedRequest[] = [];
    const { POST } = createSwigRouteHandlers({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_transfer_123',
          transaction: 'base64-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
          recentBlockhash: 'blockhash_456',
        };
      }),
    });

    const response = await POST(
      new Request('https://app.example/api/swig/transfer/sol', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
            requesterPubkey: 'requester_123',
          },
          network: 'devnet',
          destination: 'destination_123',
          amount: '42',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      prepared: {
        intentId: 'intent_transfer_123',
        transaction: 'base64-transfer-tx',
        transactionEncoding: 'base64',
        network: 'devnet',
        recentBlockhash: 'blockhash_456',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transfer/sol',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'requester_123',
        swigConfigAddress: 'swig_config_123',
        walletAddress: 'wallet_123',
        requesterPubkey: 'requester_123',
        destination: 'destination_123',
        lamports: '42',
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('uses configured requester and fee payer resolvers', async () => {
    const calls: CapturedRequest[] = [];
    const { POST } = createSwigRouteHandlers({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterPubkey: () => 'requester_123',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_transfer_123',
          transaction: 'base64-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
        };
      }),
    });

    await POST(
      new Request('https://app.example/api/swig/transfer/sol', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
          },
          network: 'devnet',
          destination: 'destination_123',
          amount: '42',
        }),
      }),
    );

    expect(calls[0]?.body).toMatchObject({
      feePayer: 'payer_123',
      requesterPubkey: 'requester_123',
    });
  });
});
