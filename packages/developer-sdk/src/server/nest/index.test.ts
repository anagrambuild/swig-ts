import { describe, expect, test } from 'bun:test';

import { createSwigNestHandler, type SwigNestResponseLike } from './index.js';

type CapturedRequest = {
  url: string;
  method?: string;
  headers: Headers;
  body: unknown;
};

class TestNestResponse implements SwigNestResponseLike {
  body?: string;
  headers = new Map<string, string>();
  statusCode = 200;

  header(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  send(body?: string) {
    this.body = body;
  }

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }
}

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

describe('createSwigNestHandler', () => {
  test('adapts a Nest request/response pair to the fetch proxy handler', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigNestHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: 'base64-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
        };
      }),
    });
    const response = new TestNestResponse();

    await handler(
      {
        body: {
          wallet: {
            swigConfigAddress: 'swig_config_123',
            requesterPubkey: 'requester_123',
          },
          network: 'devnet',
          destination: 'destination_123',
          amount: '42',
        },
        headers: {
          host: 'api.example.com',
        },
        method: 'POST',
        originalUrl: '/swig/transfer/sol',
        protocol: 'https',
      },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(response.body ?? '{}')).toEqual({
      prepared: {
        transaction: 'base64-transfer-tx',
        transactionEncoding: 'base64',
        network: 'devnet',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/transfer/sol',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'requester_123',
        swigAddress: 'swig_config_123',
        requesterPubkey: 'requester_123',
        destination: 'destination_123',
        lamports: '42',
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('adapts a Nest swap request to the fetch proxy handler', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigNestHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterPubkey: () => 'requester_123',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: 'base64-swap-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
        };
      }),
    });
    const response = new TestNestResponse();

    await handler(
      {
        body: {
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          network: 'devnet',
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '42',
          slippageBps: 100,
          wrapAndUnwrapSol: true,
        },
        headers: {
          host: 'api.example.com',
        },
        method: 'POST',
        originalUrl: '/swig/swap/jupiter',
        protocol: 'https',
      },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? '{}')).toEqual({
      prepared: {
        transaction: 'base64-swap-tx',
        transactionEncoding: 'base64',
        network: 'devnet',
      },
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/swap/jupiter',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterPubkey: 'requester_123',
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '42',
        slippageBps: 100,
        wrapAndUnwrapSol: true,
      },
    });
  });
});
