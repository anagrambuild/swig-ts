/**
 * Mock account fixtures for unit tests.
 * These provide pre-built account data for testing without LiteSVM.
 */

import { getAddressCodec } from '@solana/kit';
import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Address/PublicKey Generators
// ============================================================================

/**
 * Create a mock PublicKey from a single byte value
 */
export function mockPublicKey(byte: number): PublicKey {
  return new PublicKey(Uint8Array.from(Array(32).fill(byte)));
}

/**
 * Create a mock Solana address from a single byte value
 */
export function mockAddress(byte: number) {
  return getAddressCodec().decode(Uint8Array.from(Array(32).fill(byte)));
}

/**
 * Create a mock bytes array of specified length filled with a byte value
 */
export function mockBytesArray(byte: number, length: number): Uint8Array {
  return Uint8Array.from(Array(length).fill(byte));
}

/**
 * Generate random bytes of specified length
 */
export function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

// ============================================================================
// Mock Swig ID
// ============================================================================

/**
 * Create a deterministic swig ID from a seed value
 */
export function mockSwigId(seed: number): Uint8Array {
  return Uint8Array.from(Array(32).fill(seed));
}

/**
 * Create a random swig ID
 */
export function randomSwigId(): Uint8Array {
  return randomBytes(32);
}

// ============================================================================
// Test Constants
// ============================================================================

export const TEST_ADDRESSES = {
  payer: mockAddress(1),
  recipient: mockAddress(2),
  swig: mockAddress(3),
  subAccount: mockAddress(4),
  tokenMint: mockAddress(5),
  tokenAccount: mockAddress(6),
  systemProgram: mockAddress(0),
} as const;

export const TEST_PUBLIC_KEYS = {
  payer: mockPublicKey(1),
  recipient: mockPublicKey(2),
  swig: mockPublicKey(3),
  subAccount: mockPublicKey(4),
  tokenMint: mockPublicKey(5),
  tokenAccount: mockPublicKey(6),
} as const;

// ============================================================================
// Byte Comparison Utilities
// ============================================================================

/**
 * Compare two Uint8Arrays for equality
 */
export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Compare with debug logging on mismatch
 */
export function uint8ArraysEqualDebug(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    console.log(`Length mismatch: ${a.length} vs ${b.length}`);
    return false;
  }
  return a.every((value, index) => {
    const passed = value === b[index];
    if (!passed) {
      console.log(
        `Mismatch at index ${index}: expected ${b[index]}, got ${value}`,
      );
    }
    return passed;
  });
}
