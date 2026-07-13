import { describe, expect, test } from 'bun:test';

import {
  buildOneBusinessGrantAccessUrl,
  completeOneBusinessGrantAccess,
  DEFAULT_ONE_BUSINESS_URL,
  OneBusinessGrantAccessCallbackError,
  redirectToOneBusinessGrantAccess,
} from './index.js';

describe('One Business grant access helpers', () => {
  test('builds a One Business grant access URL', () => {
    const url = new URL(
      buildOneBusinessGrantAccessUrl({
        oneBusinessUrl: 'https://business.example/',
        swigPubkey: 'swig_config_123',
        authorityPublicKey: 'authority_123',
        appName: 'Local Trading App',
        redirectUri: 'http://localhost:5173/callback',
        state: 'state_123',
        actions: [
          {
            type: 'transferToken',
            mint: 'usdc_mint',
            amount: '10000000',
            cadence: 'daily',
          },
        ],
      }),
    );

    expect(url.origin).toBe('https://business.example');
    expect(url.pathname).toBe('/authorize/grant-access');
    expect(url.searchParams.get('swig_pubkey')).toBe('swig_config_123');
    expect(url.searchParams.get('authority_public_key')).toBe('authority_123');
    expect(url.searchParams.get('app_name')).toBe('Local Trading App');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/callback',
    );
    expect(url.searchParams.get('state')).toBe('state_123');
    expect(decodeBase64UrlJson(url.searchParams.get('actions'))).toEqual([
      {
        type: 'transferToken',
        mint: 'usdc_mint',
        amount: '10000000',
        cadence: 'daily',
      },
    ]);
  });

  test('uses the production One Business URL by default', () => {
    const url = new URL(
      buildOneBusinessGrantAccessUrl({
        swigPubkey: 'swig_config_123',
        authorityPublicKey: 'authority_123',
      }),
    );

    expect(url.origin).toBe(new URL(DEFAULT_ONE_BUSINESS_URL).origin);
  });

  test('redirects to One Business with assign or replace', () => {
    const assigned: string[] = [];
    const replaced: string[] = [];
    const location: Pick<Location, 'assign' | 'replace'> = {
      assign: (url: string | URL) => assigned.push(String(url)),
      replace: (url: string | URL) => replaced.push(String(url)),
    };

    redirectToOneBusinessGrantAccess(
      {
        oneBusinessUrl: 'https://business.example',
        swigPubkey: 'swig_config_123',
        authorityPublicKey: 'authority_123',
      },
      { location },
    );
    redirectToOneBusinessGrantAccess(
      {
        oneBusinessUrl: 'https://business.example',
        swigPubkey: 'swig_config_456',
        authorityPublicKey: 'authority_456',
      },
      { location, mode: 'replace' },
    );

    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toContain('swig_pubkey=swig_config_123');
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toContain('swig_pubkey=swig_config_456');
  });

  test('parses a successful grant access callback', () => {
    const result = completeOneBusinessGrantAccess(
      'http://localhost:5173/callback?status=granted&swig_pubkey=swig_config_123&wallet_address=wallet_123&role_id=3&authority_public_key=authority_123&signature=sig_123&state=state_123',
    );

    expect(result).toEqual({
      status: 'granted',
      swigPubkey: 'swig_config_123',
      walletAddress: 'wallet_123',
      roleId: 3,
      authorityPublicKey: 'authority_123',
      signature: 'sig_123',
      state: 'state_123',
    });
  });

  test('parses callback errors as typed grant access errors', () => {
    expect(() =>
      completeOneBusinessGrantAccess(
        'http://localhost:5173/callback?error=grant_access_failed&error_description=Not%20admin&state=state_123',
      ),
    ).toThrow(OneBusinessGrantAccessCallbackError);

    try {
      completeOneBusinessGrantAccess(
        'http://localhost:5173/callback?error=grant_access_failed&error_description=Not%20admin&state=state_123',
      );
      throw new Error('Expected callback parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OneBusinessGrantAccessCallbackError);
      expect(error).toMatchObject({
        code: 'grant_access_failed',
        description: 'Not admin',
        state: 'state_123',
      });
    }
  });
});

function decodeBase64UrlJson(value: string | null): unknown {
  if (!value) {
    return undefined;
  }
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
