import { describe, expect, test } from 'bun:test';

import { createSwigRouteHandlers } from './index.js';

describe('createSwigRouteHandlers', () => {
  test('wraps the fetch handler as a Next.js POST export', async () => {
    const { POST } = createSwigRouteHandlers({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: (async () =>
        new Response(
          JSON.stringify({
            transaction: 'base64-transfer-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )) as unknown as typeof fetch,
    });

    const response = await POST(
      new Request('https://app.example/api/swig/transfer/sol', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
          },
          network: 'devnet',
          feePayer: 'payer_123',
          destination: 'destination_123',
          amount: '42',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      prepared: {
        transaction: 'base64-transfer-tx',
      },
    });
  });
});
