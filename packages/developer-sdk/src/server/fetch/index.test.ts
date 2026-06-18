import { describe, expect, test } from 'bun:test';

import { createSwigFetchHandler, createSwigGetHandler } from './index.js';

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

  test('proxies ProgramExecProof requester authority to the transaction API', async () => {
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
        };
      }),
    });

    const requesterAuthority = {
      programExecProof: {
        roleId: 0,
        zkProof: 'proof_b64',
      },
    };

    const response = await handler(
      new Request('https://app.example/api/swig/transfer/sol', {
        method: 'POST',
        body: JSON.stringify({
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
            requesterAuthority,
          },
          network: 'devnet',
          feePayer: 'payer_123',
          destination: 'destination_123',
          amount: '42',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls[0]?.body).toMatchObject({
      requesterAuthority,
    });
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

  test('supports legacy requester pubkey resolvers', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      feePayer: 'payer_123',
      resolveRequesterPubkey: ({ wallet }) => {
        expect(wallet?.roleId).toBe(2);
        return 'requester_123';
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
          },
          network: 'devnet',
          destination: 'destination_123',
          amount: '42',
        }),
      }),
    );

    expect(calls[0]?.body).toMatchObject({
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

  test('proxies ramp quote requests without exposing the API key', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          quotes: [
            {
              quote_id: 'quote_123',
              direction: 'RAMP_DIRECTION_ONRAMP',
              service_provider: 'RAMP_SERVICE_PROVIDER_OTHER',
              payment_method_type: 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD',
              source_amount: '100.00',
              source_currency_code: 'USD',
              destination_amount: '99.00',
              destination_currency_code: 'USDC_SOLANA',
              exchange_rate: '0.99',
              total_fee: '1.00',
              network_fee: '0.10',
              transaction_fee: '0.70',
              partner_fee: '0.20',
            },
          ],
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/ramp/quote', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            organizationId: 'org_123',
            customerType: 'individual',
          },
          wallet: {
            walletId: 'wallet_123',
            walletAddress: 'wallet_address_123',
            network: 'devnet',
          },
          direction: 'onramp',
          sourceAmount: '100.00',
          sourceCurrencyCode: 'USD',
          destinationCurrencyCode: 'USDC_SOLANA',
          countryCode: 'US',
          paymentMethodType: 'credit-debit-card',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      quotes: [
        {
          quoteId: 'quote_123',
          direction: 'onramp',
          paymentMethodType: 'credit-debit-card',
        },
      ],
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/quote',
      method: 'POST',
      body: {
        customer: {
          organizationId: 'org_123',
          customerType: 'RAMP_CUSTOMER_TYPE_INDIVIDUAL',
        },
        wallet: {
          walletId: 'wallet_123',
          walletAddress: 'wallet_address_123',
          network: 'NETWORK_DEVNET',
        },
        direction: 'RAMP_DIRECTION_ONRAMP',
        paymentMethodType: 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD',
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('resolves ramp customer context server-side for quote requests', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      resolveRampCustomer: ({ route, body }) => {
        expect(route).toBe('ramp/quote');
        expect(body.customer).toMatchObject({
          organizationId: 'browser_org',
          externalCustomerId: 'browser_customer',
        });
        return {
          organizationId: 'server_org',
          partnerApplicationId: 'server_app',
          externalCustomerId: 'server_customer',
          customerType: 'individual',
        };
      },
      fetch: jsonFetch((request) => {
        calls.push(request);
        return { quotes: [] };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/ramp/quote', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            organizationId: 'browser_org',
            partnerApplicationId: 'browser_app',
            externalCustomerId: 'browser_customer',
            customerType: 'business',
          },
          wallet: {
            walletId: 'wallet_123',
            walletAddress: 'wallet_address_123',
            network: 'devnet',
          },
          direction: 'onramp',
          sourceAmount: '100.00',
          sourceCurrencyCode: 'USD',
          destinationCurrencyCode: 'USDC_SOLANA',
          countryCode: 'US',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/quote',
      body: {
        customer: {
          organizationId: 'server_org',
          partnerApplicationId: 'server_app',
          externalCustomerId: 'server_customer',
          customerType: 'RAMP_CUSTOMER_TYPE_INDIVIDUAL',
        },
      },
    });
  });

  test('resolves ramp customer context server-side for session requests', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigFetchHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      resolveRampCustomer: () => ({
        organizationId: 'server_org',
        swigUserId: 'swig_user_123',
        customerType: 'individual',
      }),
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          local_session_id: 'session_123',
          meld_session_id: 'meld_session_123',
          external_customer_id: 'swig:user:swig_user_123',
          external_session_id: 'external_session_123',
          launch_url: 'https://checkout.example/session_123',
        };
      }),
    });

    const response = await handler(
      new Request('https://app.example/api/swig/ramp/sessions', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            organizationId: 'browser_org',
            externalCustomerId: 'browser_customer',
            customerType: 'business',
          },
          wallet: {
            walletId: 'wallet_123',
            walletAddress: 'wallet_address_123',
            network: 'devnet',
          },
          direction: 'onramp',
          selectedQuoteId: 'quote_123',
          sourceAmount: '100.00',
          sourceCurrencyCode: 'USD',
          destinationCurrencyCode: 'USDC_SOLANA',
          countryCode: 'US',
          serviceProvider: 'other',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      localSessionId: 'session_123',
      externalCustomerId: 'swig:user:swig_user_123',
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/sessions',
      body: {
        customer: {
          organizationId: 'server_org',
          swigUserId: 'swig_user_123',
          customerType: 'RAMP_CUSTOMER_TYPE_INDIVIDUAL',
        },
        selectedQuoteId: 'quote_123',
      },
    });
  });
});

describe('createSwigGetHandler', () => {
  test('proxies wallet USD balance reads with the configured API key', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigGetHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          swig_config_address: 'swig_config_123',
          wallet_address: 'wallet_123',
          usd_value: 42.5,
        };
      }),
    });

    const response = await handler(
      new Request(
        'https://app.example/api/swig/wallet/swig_config_123/balance/usd?network=devnet',
        { method: 'GET' },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      usdValue: 42.5,
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/swig/swig_config_123/balance/usd?network=NETWORK_DEVNET',
      method: 'GET',
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('proxies paymaster balance reads without exposing config fields', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigGetHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          configured: true,
          kind: 'PAYMASTER_KIND_IDP',
          id: 'paymaster_123',
          address: 'paymaster_address_123',
          label: 'IdP paymaster',
          balance_lamports: '5000000000',
          balance_sol: 5,
        };
      }),
    });

    const response = await handler(
      new Request(
        'https://app.example/api/swig/paymaster/balance?network=devnet',
        {
          method: 'GET',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      configured: true,
      kind: 'idp',
      id: 'paymaster_123',
      address: 'paymaster_address_123',
      label: 'IdP paymaster',
      balanceLamports: '5000000000',
      balanceSol: 5,
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/paymaster/balance?network=devnet',
      method: 'GET',
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('proxies IDP paymaster balance reads by kind', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigGetHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          configured: true,
          kind: 'PAYMASTER_KIND_IDP',
          id: 'paymaster_123',
          address: 'paymaster_address_123',
          label: 'IdP paymaster',
          balance_lamports: '5000000000',
          balance_sol: 5,
        };
      }),
    });

    const response = await handler(
      new Request(
        'https://app.example/api/swig/paymaster/balance?network=devnet&kind=idp',
        {
          method: 'GET',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: 'idp',
      address: 'paymaster_address_123',
      balanceSol: 5,
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/paymaster/balance?network=devnet&kind=PAYMASTER_KIND_IDP',
      method: 'GET',
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });

  test('resolves ramp customer context server-side for options reads', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigGetHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      resolveRampCustomer: ({ route }) => {
        expect(route).toBe('ramp/options');
        return {
          organizationId: 'server_org',
          partnerApplicationId: 'server_app',
          customerType: 'individual',
        };
      },
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          country_codes: ['US'],
          fiat_currency_codes: ['USD'],
          payment_method_types: ['RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD'],
          crypto_currency_codes: ['USDC_SOLANA'],
        };
      }),
    });

    const response = await handler(
      new Request(
        'https://app.example/api/swig/ramp/options?organizationId=browser_org&partnerApplicationId=browser_app&countryCode=US&fiatCurrencyCode=USD',
        { method: 'GET' },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      countryCodes: ['US'],
      fiatCurrencyCodes: ['USD'],
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/options?organizationId=server_org&partnerApplicationId=server_app&countryCode=US&fiatCurrencyCode=USD',
      method: 'GET',
    });
  });

  test('proxies ramp transaction history reads without exposing the API key', async () => {
    const calls: CapturedRequest[] = [];
    const handler = createSwigGetHandler({
      apiKey: 'sk_test',
      transactionApiUrl: 'http://localhost:8080',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transactions: [
            {
              transaction_id: 'txn_123',
              wallet_id: 'wallet_123',
              direction: 'RAMP_DIRECTION_ONRAMP',
              transaction_type: 'RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE',
              status: 'RAMP_TRANSACTION_STATUS_PENDING',
              service_provider: 'RAMP_SERVICE_PROVIDER_OTHER',
              source_amount: '100.00',
              source_currency_code: 'USD',
              destination_currency_code: 'USDC_SOLANA',
              created_at: '2026-06-06T00:00:00Z',
              updated_at: '2026-06-06T00:01:00Z',
            },
          ],
        };
      }),
    });

    const response = await handler(
      new Request(
        'https://app.example/api/swig/ramp/wallets/wallet_123/transactions?network=NETWORK_DEVNET&direction=RAMP_DIRECTION_ONRAMP&status=RAMP_TRANSACTION_STATUS_PENDING&limit=25',
        { method: 'GET' },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      transactions: [
        {
          transactionId: 'txn_123',
          status: 'pending',
          transactionType: 'crypto-purchase',
        },
      ],
    });
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/wallets/wallet_123/transactions?network=NETWORK_DEVNET&direction=RAMP_DIRECTION_ONRAMP&status=RAMP_TRANSACTION_STATUS_PENDING&limit=25',
      method: 'GET',
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
  });
});
