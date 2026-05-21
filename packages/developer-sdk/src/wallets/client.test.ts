import { describe, expect, test } from 'bun:test';

import { SwigClient } from '../server/typescript/index.js';
import { WalletsClient } from './client.js';
import {
  addRecoveryAuthorityRequest,
  cancelRecoveryRequest,
  configureRecoveryRequest,
  executeRecoveryRequest,
  startRecoveryRequest,
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
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
      },
      { network: 'devnet' },
    );

    expect(wallet.swigConfigAddress).toBe('swig_config_123');
    expect(wallet.walletAddress).toBe('wallet_123');
    expect(wallet.requesterAuthority).toEqual({
      ed25519: { publicKey: 'requester_123' },
    });
    expect(wallet.network).toBe('devnet');
  });

  test('creates a wallet handle from a Swig address string', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'devnet',
    );

    const wallet = wallets.use('swig_config_123', {
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });

    expect(wallet.swigConfigAddress).toBe('swig_config_123');
    expect(wallet.requesterAuthority).toEqual({
      ed25519: { publicKey: 'requester_123' },
    });
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
          destinationAccount: 'destination_account_123',
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
      inputMint: 'input_mint_123',
      outputMint: 'output_mint_123',
      amount: '1000',
      slippageBps: 75,
      destinationAccount: 'destination_account_123',
      wrapAndUnwrapSol: undefined,
      tipAmountLamports: '5000',
      computeUnitPricePercentile: 'high',
      maxAccounts: 32,
      mode: 'fast',
      blockhashSlotsToExpiry: 10,
    });
  });

  test('builds recovery requests for the transaction API', () => {
    const wallets = new WalletsClient(
      { post: async () => ({}) } as never,
      'devnet',
    );
    const wallet = wallets.use({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });

    expect(
      startRecoveryRequest(
        wallet,
        {
          feePayer: 'payer_123',
          guardianPubkey: 'guardian_123',
          newAuthority: 'new_authority_123',
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      guardianPubkey: 'guardian_123',
      newAuthority: 'new_authority_123',
    });
    expect(
      addRecoveryAuthorityRequest(
        wallet,
        {
          feePayer: 'payer_123',
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });
    expect(
      configureRecoveryRequest(
        wallet,
        {
          feePayer: 'payer_123',
          guardianPubkey: 'guardian_123',
          delaySeconds: 86_400,
          targetRoleId: 0,
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      guardianPubkey: 'guardian_123',
      delaySeconds: 86_400,
      targetRoleId: 0,
    });
    expect(
      cancelRecoveryRequest(
        wallet,
        {
          feePayer: 'payer_123',
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });
    expect(
      executeRecoveryRequest(
        wallet,
        {
          feePayer: 'payer_123',
          newAuthority: 'new_authority_123',
        },
        'devnet',
      ),
    ).toEqual({
      network: 'NETWORK_DEVNET',
      feePayer: 'payer_123',
      swigAddress: 'swig_config_123',
      newAuthority: 'new_authority_123',
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
          network: 'NETWORK_DEVNET',
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          transactions: [
            {
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

    const created = await swig.wallets.create({
      feePayer: 'payer_123',
      policyId: 'policy_123',
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/policies/policy_123',
      method: 'GET',
    });
    expect(calls[1]).toMatchObject({
      url: 'http://localhost:8080/transaction/wallet/create',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        policyId: 'policy_123',
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
    expect(calls[1]?.headers.get('authorization')).toBe('Bearer sk_test');
    expect(created.wallet).toEqual({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      network: 'devnet',
    });
    expect(created.transactions).toHaveLength(1);
    expect(created.creationTransaction).toMatchObject({
      transaction: 'base64-create-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_123',
      kind: 'create-swig-wallet',
    });
    expect(created.feePayerOnlyTransactions).toHaveLength(1);
    expect(created.clientAuthorityTransactions).toEqual([]);
    expect(created.operatorSignedTransactions).toEqual([]);
  });

  test('returns a recovery setup plan from a recovery-enabled policy', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        if (request.method === 'GET') {
          return {
            id: 'policy_recovery_123',
            name: 'Recovery policy',
            description: null,
            authority: {
              type: 'Secp256r1',
              publicKey: 'passkey_public_key_123',
            },
            actions: [{ type: 'All' }],
            guardianEnabled: true,
            guardianAuthority: {
              type: 'Ed25519',
              publicKey: 'guardian_123',
            },
            guardianDelaySeconds: 86_400,
          };
        }

        return {
          network: 'NETWORK_DEVNET',
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
        };
      }),
    });

    const created = await swig.wallets.create({
      feePayer: 'payer_123',
      policyId: 'policy_recovery_123',
    });

    expect(calls).toHaveLength(2);
    expect(created.transactions).toHaveLength(1);
    expect(created.recoverySetup).toEqual({
      requesterAuthority: {
        secp256r1: {
          publicKey: 'passkey_public_key_123',
        },
      },
      guardianPubkey: 'guardian_123',
      delaySeconds: 86_400,
      targetRoleId: 0,
    });
  });

  test('uses create recovery options when the policy guardian is provided at creation', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        if (request.method === 'GET') {
          return {
            id: 'policy_recovery_at_creation_123',
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
          network: 'NETWORK_DEVNET',
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
        };
      }),
    });

    const created = await swig.wallets.create({
      feePayer: 'payer_123',
      policyId: 'policy_recovery_at_creation_123',
      initialUser: {
        secp256r1: {
          publicKey: 'passkey_public_key_123',
        },
      },
      recovery: {
        guardianPubkey: 'guardian_123',
      },
    });

    expect(calls).toHaveLength(2);
    expect(created.recoverySetup).toEqual({
      requesterAuthority: {
        secp256r1: {
          publicKey: 'passkey_public_key_123',
        },
      },
      guardianPubkey: 'guardian_123',
      delaySeconds: 1,
      targetRoleId: 0,
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
          network: 'NETWORK_DEVNET',
          wallet: {
            swigConfigAddress: 'swig_config_456',
            walletAddress: 'wallet_456',
          },
          transactions: [
            {
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        destination: 'destination_123',
        lamports: '42',
      },
    });
    expect(prepared).toMatchObject({
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
          transaction: 'base64-token-transfer-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
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
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        mint: 'mint_123',
        destinationOwner: 'owner_123',
        amount: '42',
      },
    });
    expect(prepared).toMatchObject({
      transaction: 'base64-token-transfer-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
    });
  });

  test('prepares grouped wallet operations through the transaction API', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          wallet: {
            swigConfigAddress: 'swig_config_123',
            walletAddress: 'wallet_123',
          },
          transactions: [
            {
              transaction: 'base64-grouped-tx',
              transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
              network: 'NETWORK_DEVNET',
              recentBlockhash: 'blockhash_grouped',
            },
          ],
          network: 'NETWORK_DEVNET',
        };
      }),
    });
    const wallet = swig.wallets.use({
      swigConfigAddress: 'swig_config_123',
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });

    const prepared = await wallet.prepare({
      feePayer: 'payer_123',
      operations: [
        {
          type: 'transferSol',
          destination: 'destination_123',
          amount: 42n,
        },
        {
          type: 'transferToken',
          mint: 'mint_123',
          destinationOwner: 'owner_123',
          amount: '2500',
        },
      ],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/prepare',
      method: 'POST',
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
    expect(prepared.transactions).toHaveLength(1);
    expect(prepared.transactions[0]).toMatchObject({
      transaction: 'base64-grouped-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_grouped',
    });
    expect(prepared.wallet).toEqual({
      swigConfigAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      network: 'devnet',
    });
    expect(prepared.feePayerOnlyTransactions).toHaveLength(1);
    expect(prepared.clientAuthorityTransactions).toEqual([]);
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });

    const prepared = await wallet.swap.jupiter({
      feePayer: 'payer_123',
      inputMint: 'input_mint_123',
      outputMint: 'output_mint_123',
      amount: 42n,
      slippageBps: 100,
      destinationAccount: 'destination_account_123',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/swap/jupiter',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
        inputMint: 'input_mint_123',
        outputMint: 'output_mint_123',
        amount: '42',
        slippageBps: 100,
        destinationAccount: 'destination_account_123',
      },
    });
    expect(prepared).toMatchObject({
      transaction: 'base64-swap-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
      recentBlockhash: 'blockhash_789',
    });
  });

  test('prepares recovery setup through the explicit setup endpoints', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        if (request.url.endsWith('/transaction/recovery/configure')) {
          return {
            transaction: 'base64-configure-recovery-tx',
            transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
            network: 'NETWORK_DEVNET',
            kind: 'PREPARED_TRANSACTION_KIND_CONFIGURE_RECOVERY',
            wallet: {
              swigConfigAddress: 'swig_config_123',
              walletAddress: 'wallet_123',
            },
          };
        }

        return {
          transaction: 'base64-add-authority-tx',
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
          kind: 'PREPARED_TRANSACTION_KIND_ADD_AUTHORITY',
          signatureRequests: [
            {
              scheme: 'AUTHORITY_SIGNATURE_SCHEME_SECP256R1',
              signer: 'passkey_public_key_123',
              messageHash: 'hash_123',
              slot: 123,
              counter: 1,
            },
          ],
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
      requesterAuthority: { secp256r1: { publicKey: 'passkey_123' } },
    });

    const prepared = await wallet.recovery.prepareSetup({
      feePayer: 'payer_123',
      guardianPubkey: 'guardian_123',
      delaySeconds: 86_400,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/wallet/recovery-authority/add',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { secp256r1: { publicKey: 'passkey_123' } },
      },
    });
    expect(calls[1]).toMatchObject({
      url: 'http://localhost:8080/transaction/recovery/configure',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        guardianPubkey: 'guardian_123',
        delaySeconds: 86_400,
      },
    });
    expect(prepared.transactions).toHaveLength(2);
    expect(prepared.clientAuthorityTransactions).toHaveLength(1);
    expect(prepared.operatorSignedTransactions).toHaveLength(1);
    expect(prepared.addAuthorityTransaction).toMatchObject({
      transaction: 'base64-add-authority-tx',
      kind: 'add-authority',
    });
    expect(prepared.configureRecoveryTransaction).toMatchObject({
      transaction: 'base64-configure-recovery-tx',
      kind: 'configure-recovery',
    });
  });

  test('prepares recovery flow through the transaction API', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          transaction: `base64-${calls.length}-tx`,
          transactionEncoding: 'TRANSACTION_ENCODING_BASE64',
          network: 'NETWORK_DEVNET',
          recentBlockhash: 'blockhash_recovery',
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
      requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
    });

    const started = await wallet.recovery.start({
      feePayer: 'payer_123',
      guardianPubkey: 'guardian_123',
      newAuthority: 'new_authority_123',
    });
    const cancelled = await wallet.recovery.cancel({
      feePayer: 'payer_123',
    });
    const executed = await wallet.recovery.execute({
      feePayer: 'payer_123',
      newAuthority: 'new_authority_123',
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/transaction/recovery/start',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        guardianPubkey: 'guardian_123',
        newAuthority: 'new_authority_123',
      },
    });
    expect(calls[1]).toMatchObject({
      url: 'http://localhost:8080/transaction/recovery/cancel',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        requesterAuthority: { ed25519: { publicKey: 'requester_123' } },
      },
    });
    expect(calls[2]).toMatchObject({
      url: 'http://localhost:8080/transaction/recovery/execute',
      method: 'POST',
      body: {
        network: 'NETWORK_DEVNET',
        feePayer: 'payer_123',
        swigAddress: 'swig_config_123',
        newAuthority: 'new_authority_123',
      },
    });
    expect(started).toMatchObject({
      transaction: 'base64-1-tx',
      transactionEncoding: 'base64',
      network: 'devnet',
    });
    expect(cancelled.transaction).toBe('base64-2-tx');
    expect(executed.transaction).toBe('base64-3-tx');
  });
});
