import { describe, expect, test } from 'bun:test';

import { SwigBrowserClient, SwigBrowserProxyError } from './browser.js';

type CapturedRequest = {
  url: string;
  method?: string;
  headers: Headers;
  body: unknown;
};

type JsonFetchResult =
  | unknown
  | {
      status: number;
      body: unknown;
    };

function jsonFetch(
  handler: (request: CapturedRequest) => JsonFetchResult,
): typeof fetch {
  return (async (input, init) => {
    const request = new Request(absoluteUrl(input), init);
    const text = await request.text();
    const result = handler({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: text ? JSON.parse(text) : undefined,
    });
    const response = isJsonFetchResponse(result)
      ? result
      : { status: 200, body: result };

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('SwigBrowserClient', () => {
  test('prepares SOL transfers through the local proxy without an API key', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            transaction: 'base64-transfer-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            network: 'NETWORK_DEVNET',
            recentBlockhash: 'blockhash_123',
          },
        };
      }),
    });
    const wallet = swig.wallets.fromIdpSession({
      configAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      roleId: 2,
      authFlow: 'role',
      updatedAt: 1_748_000_000,
    });

    const prepared = await wallet.transfer.sol({
      destination: 'destination_123',
      amount: 42n,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/transfer/sol',
      method: 'POST',
      body: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
          roleId: 2,
          network: 'devnet',
        },
        network: 'devnet',
        destination: 'destination_123',
        amount: '42',
      },
    });
    expect(calls[0]?.headers.has('authorization')).toBe(false);
    expect(prepared).toMatchObject({
      transaction: 'base64-transfer-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_123',
    });
  });

  test('prepares SPL token transfers through a custom local proxy path', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      basePath: '/wallet/api/swig/',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            transaction: 'base64-token-transfer-tx',
            transactionEncoding: 'base64',
            network: 'devnet',
          },
        };
      }),
    });
    const wallet = swig.wallets.use(
      {
        swigConfigAddress: 'swig_config_123',
        walletAddress: 'wallet_123',
      },
      {
        network: 'devnet',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
      },
    );

    const prepared = await wallet.transfer.token({
      feePayer: 'payer_123',
      mint: 'mint_123',
      destinationOwner: 'owner_123',
      amount: '2500',
    });

    expect(calls[0]).toMatchObject({
      url: 'https://app.example/wallet/api/swig/transfer/spl-token',
      body: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
          network: 'devnet',
          requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        },
        network: 'devnet',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        feePayer: 'payer_123',
        mint: 'mint_123',
        destinationOwner: 'owner_123',
        amount: '2500',
      },
    });
    expect(prepared.transaction).toBe('base64-token-transfer-tx');
  });

  test('prepares grouped wallet operations through the proxy route', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            wallet: {
              swigConfigAddress: 'swig_config_123',
              walletAddress: 'wallet_123',
            },
            transactions: [
              {
                transaction: 'base64-prepare-tx',
                transactionEncoding: 'base64',
                network: 'devnet',
              },
            ],
            network: 'devnet',
          },
        };
      }),
    });
    const wallet = swig.wallets.use('swig_config_123');

    const prepared = await wallet.prepare({
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
      operations: [
        {
          type: 'transferSol',
          destination: 'destination_123',
          amount: 1_000n,
        },
        {
          type: 'transferToken',
          mint: 'mint_123',
          destinationOwner: 'owner_123',
          amount: '2500',
        },
      ],
    });

    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/prepare',
      body: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          network: 'devnet',
          requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        },
        network: 'devnet',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        operations: [
          {
            type: 'transferSol',
            destination: 'destination_123',
            amount: '1000',
          },
          {
            type: 'transferToken',
            mint: 'mint_123',
            destinationOwner: 'owner_123',
            amount: '2500',
          },
        ],
      },
    });
    expect(prepared.transactions).toHaveLength(1);
    expect(prepared.wallet).toEqual({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      network: 'devnet',
    });
  });

  test('prepares Jupiter swaps through the proxy route', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            transaction: 'base64-swap-tx',
            transactionEncoding: 'base64',
            network: 'devnet',
          },
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      authorityPublicKey: 'authority_123',
    });

    const prepared = await wallet.swap.jupiter({
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 42n,
      slippageBps: 75,
      tipAmountLamports: 5_000n,
      maxAccounts: 32,
    });

    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/swap/jupiter',
      body: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          authorityPublicKey: 'authority_123',
          network: 'devnet',
          requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        },
        network: 'devnet',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '42',
        slippageBps: 75,
        tipAmountLamports: '5000',
        maxAccounts: 32,
      },
    });
    expect(prepared.transaction).toBe('base64-swap-tx');
  });

  test('reads wallet balances through the local proxy without an API key', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          swigConfigAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
          usdValue: 123.45,
        };
      }),
    });
    const wallet = swig.wallets.fromIdpSession({
      configAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      roleId: 0,
    });

    const balance = await wallet.getUsdBalance();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/wallet/swig_config_123/balance/usd?network=devnet',
      method: 'GET',
      body: undefined,
    });
    expect(calls[0]?.headers.has('authorization')).toBe(false);
    expect(balance).toEqual({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      usdValue: 123.45,
    });
  });

  test('reads paymaster balance through the local proxy without an API key', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          configured: true,
          kind: 'idp',
          id: 'paymaster_123',
          address: 'paymaster_address_123',
          label: 'IdP paymaster',
          balanceLamports: '5000000000',
          balanceSol: 5,
        };
      }),
    });

    const balance = await swig.paymaster.getBalance();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/paymaster/balance?network=devnet',
      method: 'GET',
      body: undefined,
    });
    expect(calls[0]?.headers.has('authorization')).toBe(false);
    expect(balance).toMatchObject({
      configured: true,
      address: 'paymaster_address_123',
      balanceSol: 5,
    });
  });

  test('throws proxy errors with the route response status and message', async () => {
    const swig = new SwigBrowserClient({
      fetch: jsonFetch(() => ({
        status: 401,
        body: { error: 'requesterAuthority is required' },
      })),
    });
    const wallet = swig.wallets.use('swig_config_123', { network: 'devnet' });

    try {
      await wallet.transfer.sol({
        destination: 'destination_123',
        amount: 1n,
      });
      throw new Error('Expected transfer to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(SwigBrowserProxyError);
      expect(error).toMatchObject({
        message: 'requesterAuthority is required',
        status: 401,
        body: { error: 'requesterAuthority is required' },
      });
    }
  });
});

function absoluteUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && input.startsWith('/')) {
    return `https://app.example${input}`;
  }
  return input;
}

function isJsonFetchResponse(
  value: JsonFetchResult,
): value is { status: number; body: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'number' &&
    'body' in value
  );
}
