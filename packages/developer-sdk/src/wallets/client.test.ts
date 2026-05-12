import { describe, expect, test } from 'bun:test';

import type { HttpClient } from '../core/index.js';
import { WalletsClient } from './client.js';
import { swapRequest } from './requests.js';

describe('WalletsClient', () => {
  test('creates a wallet handle from an IdP session', () => {
    const wallets = new WalletsClient({} as HttpClient, 'mainnet');

    const wallet = wallets.fromIdpSession(
      {
        configAddress: 'swig_config_123',
        walletAddress: 'wallet_123',
        roleId: 7,
      },
      { network: 'devnet' },
    );

    expect(wallet.swigConfigAddress).toBe('swig_config_123');
    expect(wallet.walletAddress).toBe('wallet_123');
    expect(wallet.roleId).toBe(7);
    expect(wallet.network).toBe('devnet');
  });

  test('includes roleId when preparing wallet action requests', () => {
    const wallets = new WalletsClient({} as HttpClient, 'mainnet');
    const wallet = wallets.fromIdpSession({
      configAddress: 'swig_config_123',
      walletAddress: 'wallet_123',
      roleId: 7,
    });

    expect(
      swapRequest(
        wallet,
        {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'USDC',
          amount: 1_000_000n,
        },
        'mainnet',
      ),
    ).toMatchObject({
      wallet: 'swig_config_123',
      roleId: 7,
      network: 'mainnet',
    });
  });
});
