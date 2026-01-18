/**
 * Test fixtures for creating authorities of all types.
 * Used for systematic testing across Ed25519, Secp256k1, and Secp256r1.
 */

import { Wallet } from '@ethereumjs/wallet';
import { p256 } from '@noble/curves/nist';
import {
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  createSecp256k1AuthorityInfo,
  createSecp256k1SessionAuthorityInfo,
  createSecp256r1AuthorityInfo,
  createSecp256r1SessionAuthorityInfo,
  getSigningFnForSecp256k1PrivateKey,
  getSigningFnForSecp256r1PrivateKey,
  type CreateAuthorityInfo,
  type SigningFn,
} from '../../src';
import { generateTestKeypair, type TestKeypair } from '../helpers';

// ============================================================================
// Types
// ============================================================================

export type AuthorityType =
  | 'Ed25519'
  | 'Secp256k1'
  | 'Secp256r1'
  | 'Ed25519Session'
  | 'Secp256k1Session'
  | 'Secp256r1Session';

export interface TestAuthority {
  name: AuthorityType;
  authorityInfo: CreateAuthorityInfo;
  signingFn: SigningFn | null;
  signer: TestKeypair | null;
  isSession: boolean;
}

export interface TestAuthorityFactory {
  name: AuthorityType;
  create: () => TestAuthority;
  isSession: boolean;
}

// ============================================================================
// Ed25519 Authority
// ============================================================================

export function createTestEd25519Authority(): TestAuthority {
  const keypair = generateTestKeypair();
  const authorityInfo = createEd25519AuthorityInfo(keypair.address);

  return {
    name: 'Ed25519',
    authorityInfo,
    signingFn: null, // Ed25519 uses native Solana signing via signers array
    signer: keypair,
    isSession: false,
  };
}

export function createTestEd25519SessionAuthority(
  maxSessionDuration = 1000n,
): TestAuthority {
  const keypair = generateTestKeypair();
  const authorityInfo = createEd25519SessionAuthorityInfo(
    keypair.address,
    maxSessionDuration,
  );

  return {
    name: 'Ed25519Session',
    authorityInfo,
    signingFn: null,
    signer: keypair,
    isSession: true,
  };
}

// ============================================================================
// Secp256k1 Authority
// ============================================================================

export interface Secp256k1TestAuthority extends TestAuthority {
  wallet: Wallet;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: Uint8Array;
}

export function createTestSecp256k1Authority(): Secp256k1TestAuthority {
  const wallet = Wallet.generate();
  const privateKey = wallet.getPrivateKey();
  const publicKey = wallet.getPublicKey();
  const authorityInfo = createSecp256k1AuthorityInfo(publicKey);
  const signingFn = getSigningFnForSecp256k1PrivateKey(privateKey);

  return {
    name: 'Secp256k1',
    authorityInfo,
    signingFn,
    signer: null,
    isSession: false,
    wallet,
    privateKey,
    publicKey,
    address: wallet.getAddress(),
  };
}

export function createTestSecp256k1SessionAuthority(
  maxSessionDuration = 1000n,
): Secp256k1TestAuthority {
  const wallet = Wallet.generate();
  const privateKey = wallet.getPrivateKey();
  const publicKey = wallet.getPublicKey();
  const authorityInfo = createSecp256k1SessionAuthorityInfo(
    publicKey,
    maxSessionDuration,
  );
  const signingFn = getSigningFnForSecp256k1PrivateKey(privateKey);

  return {
    name: 'Secp256k1Session',
    authorityInfo,
    signingFn,
    signer: null,
    isSession: true,
    wallet,
    privateKey,
    publicKey,
    address: wallet.getAddress(),
  };
}

// ============================================================================
// Secp256r1 Authority
// ============================================================================

export interface Secp256r1TestAuthority extends TestAuthority {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  compressedPublicKey: Uint8Array;
}

export function createTestSecp256r1Authority(): Secp256r1TestAuthority {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(privateKey, false); // uncompressed
  const compressedPublicKey = p256.getPublicKey(privateKey, true); // compressed (33 bytes)

  const authorityInfo = createSecp256r1AuthorityInfo(compressedPublicKey);
  const signingFn = getSigningFnForSecp256r1PrivateKey(privateKey);

  return {
    name: 'Secp256r1',
    authorityInfo,
    signingFn,
    signer: null,
    isSession: false,
    privateKey,
    publicKey,
    compressedPublicKey,
  };
}

export function createTestSecp256r1SessionAuthority(
  maxSessionDuration = 1000n,
): Secp256r1TestAuthority {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(privateKey, false);
  const compressedPublicKey = p256.getPublicKey(privateKey, true);

  const authorityInfo = createSecp256r1SessionAuthorityInfo(
    compressedPublicKey,
    maxSessionDuration,
  );
  const signingFn = getSigningFnForSecp256r1PrivateKey(privateKey);

  return {
    name: 'Secp256r1Session',
    authorityInfo,
    signingFn,
    signer: null,
    isSession: true,
    privateKey,
    publicKey,
    compressedPublicKey,
  };
}

// ============================================================================
// Authority Factory Collections
// ============================================================================

/**
 * Base authority types (non-session)
 */
export const BASE_AUTHORITY_FACTORIES: TestAuthorityFactory[] = [
  { name: 'Ed25519', create: createTestEd25519Authority, isSession: false },
  { name: 'Secp256k1', create: createTestSecp256k1Authority, isSession: false },
  { name: 'Secp256r1', create: createTestSecp256r1Authority, isSession: false },
];

/**
 * Session-based authority types
 */
export const SESSION_AUTHORITY_FACTORIES: TestAuthorityFactory[] = [
  {
    name: 'Ed25519Session',
    create: createTestEd25519SessionAuthority,
    isSession: true,
  },
  {
    name: 'Secp256k1Session',
    create: createTestSecp256k1SessionAuthority,
    isSession: true,
  },
  {
    name: 'Secp256r1Session',
    create: createTestSecp256r1SessionAuthority,
    isSession: true,
  },
];

/**
 * All authority types (base + session)
 */
export const ALL_AUTHORITY_FACTORIES: TestAuthorityFactory[] = [
  ...BASE_AUTHORITY_FACTORIES,
  ...SESSION_AUTHORITY_FACTORIES,
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Helper to determine if an authority requires a SigningFn (non-Ed25519)
 */
export function requiresSigningFn(authority: TestAuthority): boolean {
  return authority.name.startsWith('Secp');
}

/**
 * Helper to determine if an authority requires a native signer (Ed25519)
 */
export function requiresNativeSigner(authority: TestAuthority): boolean {
  return authority.name.startsWith('Ed25519');
}

/**
 * Get the signer keypairs for a test authority (for transaction signing)
 */
export function getSignerKeypairs(authority: TestAuthority): TestKeypair[] {
  if (authority.signer) {
    return [authority.signer];
  }
  return [];
}
