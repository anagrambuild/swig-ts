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

  test('wraps the fetch handler as a Next.js GET export', async () => {
    const { GET } = createSwigRouteHandlers({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: (async () =>
        new Response(
          JSON.stringify({
            configured: true,
            kind: 'PAYMASTER_KIND_API',
            id: 'paymaster_123',
            address: 'paymaster_address_123',
            label: 'Primary',
            balance_lamports: '1000000000',
            balance_sol: 1,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )) as unknown as typeof fetch,
    });

    const response = await GET(
      new Request(
        'https://app.example/api/swig/paymaster/balance?network=devnet',
        {
          method: 'GET',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      configured: true,
      address: 'paymaster_address_123',
      balanceSol: 1,
    });
  });
});
