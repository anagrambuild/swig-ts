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
  test('prepares wallet creation through an app proxy', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      proxyUrl: 'https://app.example/api/swig',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            intentId: 'intent_create_123',
            wallet: {
              swigId: 'swig_123',
              swigConfigAddress: 'swig_config_123',
              walletAddress: 'wallet_123',
            },
            transactions: [
              {
                intentId: 'intent_create_123',
                transaction: 'base64-create-tx',
                transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
                network: 'NETWORK_DEVNET',
                kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
              },
            ],
            network: 'NETWORK_DEVNET',
          },
        };
      }),
    });

    const wallet = await swig.wallets.create({
      initialUser: {
        ed25519: {
          publicKey: 'initial_user_123',
        },
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/wallet/create',
      method: 'POST',
      body: {
        network: 'devnet',
        initialUser: {
          ed25519: {
            publicKey: 'initial_user_123',
          },
        },
      },
    });
    expect(wallet.swigConfigAddress).toBe('swig_config_123');
    expect(wallet.creationTransaction).toMatchObject({
      intentId: 'intent_create_123',
      transaction: 'base64-create-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      kind: 'create-swig-wallet',
    });
  });

  test('prepares SOL transfers through an app proxy', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      proxyUrl: 'https://app.example/api/swig',
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
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterPubkey: 'requester_123',
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
          requesterPubkey: 'requester_123',
        },
        network: 'devnet',
        destination: 'destination_123',
        amount: '42',
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

  test('prepares token transfers through an app proxy', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      proxyUrl: 'https://app.example/api/swig',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            intentId: 'intent_token_transfer_123',
            transaction: 'base64-token-transfer-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            network: 'NETWORK_DEVNET',
          },
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      requesterPubkey: 'requester_123',
    });

    const prepared = await wallet.transfer.token({
      mint: 'mint_123',
      destinationOwner: 'owner_123',
      amount: 42n,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/transfer/spl-token',
      method: 'POST',
      body: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          requesterPubkey: 'requester_123',
        },
        network: 'devnet',
        mint: 'mint_123',
        destinationOwner: 'owner_123',
        amount: '42',
      },
    });
    expect(prepared).toMatchObject({
      intentId: 'intent_token_transfer_123',
      transaction: 'base64-token-transfer-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
    });
  });

  test('prepares Jupiter swaps through an app proxy', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigBrowserClient({
      proxyUrl: 'https://app.example/api/swig',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          prepared: {
            intentId: 'intent_swap_123',
            transaction: 'base64-swap-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            network: 'NETWORK_DEVNET',
          },
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      requesterPubkey: 'requester_123',
    });

    const prepared = await wallet.swap.jupiter({
      inputMint: 'input_mint_123',
      outputMint: 'output_mint_123',
      amount: 42n,
      slippageBps: 100,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'https://app.example/api/swig/swap/jupiter',
      method: 'POST',
      body: {
        wallet: {
          swigConfigAddress: 'swig_config_123',
          requesterPubkey: 'requester_123',
        },
        network: 'devnet',
        inputMint: 'input_mint_123',
        outputMint: 'output_mint_123',
        amount: '42',
        slippageBps: 100,
      },
    });
    expect(prepared).toMatchObject({
      intentId: 'intent_swap_123',
      transaction: 'base64-swap-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
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
