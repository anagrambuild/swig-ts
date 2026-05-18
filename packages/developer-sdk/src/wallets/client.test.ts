import { describe, expect, test } from 'bun:test';

import { SwigClient } from '../server/typescript/index.js';
import { WalletsClient } from './client.js';
import {
  swapRequest,
  transferSolRequest,
  transferTokenRequest,
} from './requests.js';

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

describe('WalletsClient', () => {
  test('creates a wallet handle from an IdP session', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'mainnet',
    );

    const wallet = wallets.fromIdpSession(
      {
        configAddress: 'swig_config_123',
        walletAddress: 'wallet_123',
        requesterPubkey: 'requester_123',
      },
      { network: 'devnet' },
    );

    expect(wallet.swigConfigAddress).toBe('swig_config_123');
    expect(wallet.walletAddress).toBe('wallet_123');
    expect(wallet.requesterPubkey).toBe('requester_123');
    expect(wallet.network).toBe('devnet');
  });

  test('creates a wallet handle from a Swig address string', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'devnet',
    );

    const wallet = wallets.use('swig_config_123', {
      requesterPubkey: 'requester_123',
    });

    expect(wallet.swigConfigAddress).toBe('swig_config_123');
    expect(wallet.requesterPubkey).toBe('requester_123');
    expect(wallet.network).toBe('devnet');
  });

  test('builds SOL transfer requests for the transaction API', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'mainnet',
    );
    const wallet = wallets.fromIdpSession({
      configAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterPubkey: 'requester_123',
    });

    expect(
      transferSolRequest(
        wallet,
        {
          feePayer: 'payer_123',
          destination: 'destination_123',
          amount: 1_000_000n,
        },
        'mainnet',
      ),
    ).toEqual({
      network: 'NETWORK_MAINNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      requesterPubkey: 'requester_123',
      destination: 'destination_123',
      lamports: '1000000',
    });
  });

  test('builds token transfer requests for the transaction API', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'devnet',
    );
    const wallet = wallets.use({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterPubkey: 'requester_123',
    });

    expect(
      transferTokenRequest(
        wallet,
        {
          feePayer: 'payer_123',
          mint: 'mint_123',
          destinationOwner: 'owner_123',
          amount: '2500',
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      requesterPubkey: 'requester_123',
      mint: 'mint_123',
      destinationOwner: 'owner_123',
      amount: '2500',
    });
  });

  test('builds Jupiter swap requests for the transaction API', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'devnet',
    );
    const wallet = wallets.use({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterPubkey: 'requester_123',
    });

    expect(
      swapRequest(
        wallet,
        {
          feePayer: 'payer_123',
          inputMint: 'input_mint_123',
          outputMint: 'output_mint_123',
          amount: 1_000n,
          slippageBps: 75,
          tipAmountLamports: '5000',
          computeUnitPricePercentile: 'high',
          maxAccounts: 32,
          mode: 'fast',
          blockhashSlotsToExpiry: 10,
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      requesterPubkey: 'requester_123',
      inputMint: 'input_mint_123',
      outputMint: 'output_mint_123',
      amount: '1000',
      slippageBps: 75,
      destinationTokenAccount: undefined,
      nativeDestinationAccount: undefined,
      wrapAndUnwrapSol: undefined,
      tipAmountLamports: '5000',
      computeUnitPricePercentile: 'high',
      maxAccounts: 32,
      mode: 'fast',
      blockhashSlotsToExpiry: 10,
    });
  });

  test('prepares wallet creation through the local transaction endpoint', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_create_123',
          network: 'NETWORK_DEVNET',
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          transactions: [
            {
              intentId: 'intent_create_123',
              transaction: 'base64-create-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
              recentBlockhash: 'blockhash_123',
              expiresAt: '2026-05-13T00:00:00Z',
              kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
            },
          ],
        };
      }),
    });

    const wallet = await swig.wallets.create({
      feePayer: 'payer_123',
      policyId: 'policy_123',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/wallet/create',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        policyId: 'policy_123',
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
    expect(wallet.creationTransactions).toHaveLength(1);
    expect(wallet.creationTransaction).toMatchObject({
      intentId: 'intent_create_123',
      transaction: 'base64-create-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_123',
      kind: 'create-swig-wallet',
    });
  });

  test('prepares wallet creation without a policy id when an initial user is provided', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_create_456',
          network: 'NETWORK_DEVNET',
          wallet: {
            swigConfigAddress: 'swig_config_456',
            walletAddress: 'wallet_456',
          },
          transactions: [
            {
              intentId: 'intent_create_456',
              transaction: 'base64-create-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
              kind: 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET',
            },
          ],
        };
      }),
    });

    await swig.wallets.create({
      feePayer: 'payer_123',
      initialUser: {
        ed25519: {
          publicKey: 'initial_user_123',
        },
      },
    });

    expect(calls[0]).toMatchObject({
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

  test('prepares SOL transfers through the local transaction endpoint', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_transfer_123',
          transaction: 'base64-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
          recentBlockhash: 'blockhash_456',
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
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
      feePayer: 'payer_123',
      destination: 'destination_123',
      amount: 42n,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/transfer/sol',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterPubkey: 'requester_123',
        destination: 'destination_123',
        lamports: '42',
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

  test('prepares token transfers through the opinionated wallet API', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_token_transfer_123',
          transaction: 'base64-token-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      requesterPubkey: 'requester_123',
    });

    const prepared = await wallet.transfer.token({
      feePayer: 'payer_123',
      mint: 'mint_123',
      destinationOwner: 'owner_123',
      amount: 42n,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/transfer/spl-token',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterPubkey: 'requester_123',
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

  test('prepares Jupiter swaps through the local transaction endpoint', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          intentId: 'intent_swap_123',
          transaction: 'base64-swap-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
          recentBlockhash: 'blockhash_789',
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterPubkey: 'requester_123',
    });

    const prepared = await wallet.swap.jupiter({
      feePayer: 'payer_123',
      inputMint: 'input_mint_123',
      outputMint: 'output_mint_123',
      amount: 42n,
      slippageBps: 100,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/swap/jupiter',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterPubkey: 'requester_123',
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
      recentBlockhash: 'blockhash_789',
    });
  });
});
