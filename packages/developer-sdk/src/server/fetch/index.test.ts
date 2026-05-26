import { describe, expect, test } from 'bun:test';

import { createSwigFetchHandler } from './index.js';

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

describe('createSwigFetchHandler', () => {
  test('prepares wallet creation with the multi-transaction create response', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      fetch: jsonFetch((request) => {
        calls.push(request);
        if (request.method === 'GET') {
          return {
            id: 'policy_123',
            name: 'Default policy',
            description: null,
            authority: {
              type: 'Ed25519',
              publicKey: 'initial_user_123',
            },
            actions: [{ type: 'All' }],
            guardianEnabled: false,
            guardianAuthority: null,
            guardianDelaySeconds: 86_400,
          };
        }

        return {
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          transactions: [
            {
              transaction: 'base64-create-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
              kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
            },
          ],
          network: 'NETWORK_DEVNET',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/wallet/create', {
        method: 'POST',
        body: JSON.stringify({
          network: 'devnet',
          policyId: 'policy_123',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      prepared: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
          network: 'devnet',
        },
        transactions: [
          {
            transaction: 'base64-create-tx',
            transactionEncoding: 'base64',
            network: 'devnet',
            kind: 'create-swig-wallet',
          },
        ],
        clientAuthorityTransactions: [],
        operatorSignedTransactions: [],
        feePayerOnlyTransactions: [
          {
            transaction: 'base64-create-tx',
            transactionEncoding: 'base64',
            network: 'devnet',
            kind: 'create-swig-wallet',
          },
        ],
        creationTransaction: {
          transaction: 'base64-create-tx',
          transactionEncoding: 'base64',
          network: 'devnet',
          kind: 'create-swig-wallet',
        },
        network: 'devnet',
      },
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/policies/policy_123',
      method: 'GET',
    });
    expect(calls[1]).toMatchObject({
      url: 'http://localhost:8080/transaction/wallet/create',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        policyId: 'policy_123',
      },
    });
  });

  test('prepares wallet creation with an inline initial user when policyId is omitted', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          wallet: {
            swigConfigAddress: 'swig_config_inline_123',
            walletAddress: 'wallet_inline_123',
          },
          transactions: [
            {
              transaction: 'base64-create-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
              kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
            },
          ],
          network: 'NETWORK_DEVNET',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/wallet/create', {
        method: 'POST',
        body: JSON.stringify({
          network: 'devnet',
          initialUser: {
            ed25519: {
              publicKey: 'initial_user_123',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/wallet/create',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        initialUser: {
          ed25519: {
            publicKey: 'initial_user_123',
          },
        },
      },
    });
    expect(
      (calls[0]?.body as Record<string, unknown>).policyId,
    ).toBeUndefined();
  });

  test('passes recovery options through wallet creation', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      fetch: jsonFetch((request) => {
        calls.push(request);
        if (request.method === 'GET') {
          return {
            id: 'policy_123',
            name: 'Recovery policy',
            description: null,
            authority: null,
            actions: [{ type: 'All' }],
            guardianEnabled: true,
            guardianAuthority: null,
            guardianDelaySeconds: '1',
          };
        }

        return {
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          transactions: [
            {
              transaction: 'base64-create-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
              kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
            },
          ],
          network: 'NETWORK_DEVNET',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/wallet/create', {
        method: 'POST',
        body: JSON.stringify({
          network: 'devnet',
          policyId: 'policy_123',
          initialUser: {
            secp256r1: {
              publicKey: 'passkey_public_key_123',
            },
          },
          recovery: {
            guardianPubkey: 'guardian_123',
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      prepared: {
        recoverySetup: {
          requesterAuthority: {
            secp256r1: {
              publicKey: 'passkey_public_key_123',
            },
          },
          guardianPubkey: 'guardian_123',
          delaySeconds: 1,
          targetRoleId: 0,
        },
      },
    });
    expect(calls[1]?.body).toMatchObject({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      policyId: 'policy_123',
      initialUser: {
        secp256r1: {
          publicKey: 'passkey_public_key_123',
        },
      },
    });
  });

  test('prepares SOL transfers through the API-key server client', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: 'base64-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
          recentBlockhash: 'blockhash_456',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/transfer/sol', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
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
        transactionEncoding: 'base64',
        network: 'devnet',
        recentBlockhash: 'blockhash_456',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/transfer/sol',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        destination: 'destination_123',
        lamports: '42',
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('uses configured requester and fee payer resolvers', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterAuthority: ({ wallet }) => {
        expect(wallet?.roleId).toBe(2);
        expect(wallet?.authorityPublicKey).toBe('authority_123');
        return {
          ed25519: { publicKey: 'requester_123' },
        };
      },
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: 'base64-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
        };
      }),
    });

    await handler(
      new Request('https://app.example/api/swig/transfer/sol', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            roleId: 2,
            authorityPublicKey: 'authority_123',
          },
          network: 'devnet',
          destination: 'destination_123',
          amount: '42',
        }),
      }),
    );

    expect(calls[0]?.body).toMatchObject({
      feePayer: 'payer_123',
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });
  });

  test('prepares grouped operations through the API-key server client', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterAuthority: () => ({
        ed25519: { publicKey: 'requester_123' },
      }),
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          transactions: [
            {
              transaction: 'base64-prepare-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
            },
          ],
          network: 'NETWORK_DEVNET',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/prepare', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          network: 'devnet',
          operations: [
            {
              type: 'transferSol',
              destination: 'destination_123',
              amount: '42',
            },
            {
              type: 'transferToken',
              mint: 'mint_123',
              destinationOwner: 'owner_123',
              amount: '2500',
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      prepared: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          walletAddress: 'wallet_123',
          network: 'devnet',
        },
        transactions: [
          {
            transaction: 'base64-prepare-tx',
            transactionEncoding: 'base64',
            network: 'devnet',
          },
        ],
        feePayerOnlyTransactions: [
          {
            transaction: 'base64-prepare-tx',
            transactionEncoding: 'base64',
            network: 'devnet',
          },
        ],
      },
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/prepare',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        operations: [
          {
            transferSol: {
              destination: 'destination_123',
              lamports: '42',
            },
          },
          {
            transferToken: {
              mint: 'mint_123',
              destinationOwner: 'owner_123',
              amount: '2500',
            },
          },
        ],
      },
    });
  });

  test('prepares token transfers through the API-key server client', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterAuthority: () => ({
        ed25519: { publicKey: 'requester_123' },
      }),
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: 'base64-token-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/transfer/spl-token', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          network: 'devnet',
          mint: 'mint_123',
          destinationOwner: 'owner_123',
          amount: '42',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      prepared: {
        transaction: 'base64-token-transfer-tx',
        transactionEncoding: 'base64',
        network: 'devnet',
      },
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/transfer/spl-token',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        mint: 'mint_123',
        destinationOwner: 'owner_123',
        amount: '42',
      },
    });
  });

  test('prepares Jupiter swaps through the API-key server client', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterAuthority: () => ({
        ed25519: { publicKey: 'requester_123' },
      }),
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: 'base64-swap-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/swap/jupiter', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          network: 'devnet',
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '42',
          slippageBps: 100,
          destinationAccount: 'destination_account_123',
          wrapAndUnwrapSol: true,
          maxAccounts: 20,
          mode: 'fast',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      prepared: {
        transaction: 'base64-swap-tx',
        transactionEncoding: 'base64',
        network: 'devnet',
      },
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/swap/jupiter',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '42',
        slippageBps: 100,
        destinationAccount: 'destination_account_123',
        wrapAndUnwrapSol: true,
        maxAccounts: 20,
        mode: 'fast',
      },
    });
  });
});
