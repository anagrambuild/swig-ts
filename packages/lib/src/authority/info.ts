/**
 * AuthorityInfo - A lightweight wrapper around authority data.
 *
 * Provides typed access to authority properties and conversion to
 * CreateAuthorityInfo for wallet operations.
 *
 * @packageDocumentation
 */

import { bytesToHex } from '@noble/curves/abstract/utils';
import { AuthorityType } from '@swig-wallet/coder';
import { SolPublicKey } from '../solana.js';
import {
  compressedPubkeyToAddress,
  detectPubkeyFormat,
  uncompressedPubkeyToAddress,
} from '../utils.js';
import {
  getCreateAuthorityInfo,
  type CreateAuthorityInfo,
} from './createAuthority.js';

/**
 * A lightweight wrapper around authority data that provides typed access
 * and conversion to SDK types.
 *
 * @example
 * ```typescript
 * import { AuthorityType } from '@swig-wallet/coder';
 *
 * const authority = new AuthorityInfo(
 *   AuthorityType.Ed25519,
 *   publicKeyBytes
 * );
 *
 * console.log(authority.isSession()); // false
 * console.log(authority.isEd25519()); // true
 *
 * // Convert to CreateAuthorityInfo for wallet operations
 * const info = authority.toCreateAuthorityInfo();
 * ```
 */
export class AuthorityInfo {
  /** The authority type (enum from coder) */
  readonly type: AuthorityType;

  /** The authority identifier as raw bytes */
  readonly id: Uint8Array;

  /** Maximum session duration in slots (only for session types) */
  readonly maxDurationSlots: bigint | null;

  /**
   * Creates a new AuthorityInfo.
   *
   * @param type - The authority type enum
   * @param id - The authority identifier as bytes
   * @param maxDurationSlots - Maximum session duration (for session types)
   */
  constructor(
    type: AuthorityType,
    id: Uint8Array,
    maxDurationSlots?: bigint | null,
  ) {
    this.type = type;
    this.id = id;
    this.maxDurationSlots = maxDurationSlots ?? null;
  }

  /**
   * Returns true if this is a session authority type.
   */
  isSession = (): boolean => {
    return (
      this.type === AuthorityType.Ed25519Session ||
      this.type === AuthorityType.Secp256k1Session ||
      this.type === AuthorityType.Secp256r1Session
    );
  };

  /**
   * Returns true if this is an Ed25519 authority (token or session).
   */
  isEd25519 = (): boolean => {
    return (
      this.type === AuthorityType.Ed25519 ||
      this.type === AuthorityType.Ed25519Session
    );
  };

  /**
   * Returns true if this is a Secp256k1 authority (token or session).
   */
  isSecp256k1 = (): boolean => {
    return (
      this.type === AuthorityType.Secp256k1 ||
      this.type === AuthorityType.Secp256k1Session
    );
  };

  /**
   * Returns true if this is a Secp256r1 authority (token or session).
   */
  isSecp256r1 = (): boolean => {
    return (
      this.type === AuthorityType.Secp256r1 ||
      this.type === AuthorityType.Secp256r1Session
    );
  };

  /**
   * Converts the authority's raw public key bytes to the on-chain address
   * representation.
   *
   * For Ed25519/ProgramExec: returns the id bytes as-is (already matches on-chain).
   * For Secp256k1: derives the 20-byte Ethereum address from the public key.
   * For Secp256r1: returns the id bytes as-is (already matches on-chain).
   *
   * @returns The on-chain authority address bytes
   */
  address = (): Uint8Array => {
    if (this.isSecp256k1()) {
      const format = detectPubkeyFormat(this.id);
      if (format === 'compressed') {
        return compressedPubkeyToAddress(this.id);
      }
      return uncompressedPubkeyToAddress(this.id);
    }
    return this.id;
  };

  /**
   * String representation of the authority address.
   *
   * For Ed25519: base58 encoded.
   * For Secp256k1/Secp256r1: unprefixed hex.
   *
   * @returns The authority address as a human-readable string
   */
  addressString = (): string => {
    if (this.isEd25519()) {
      return new SolPublicKey(this.id).toBase58();
    }
    return bytesToHex(this.address());
  };

  /**
   * Converts this authority data to a CreateAuthorityInfo object
   * that can be used for wallet operations.
   *
   * @returns CreateAuthorityInfo for use with Swig wallet operations
   */
  toCreateAuthorityInfo = (): CreateAuthorityInfo => {
    return getCreateAuthorityInfo(
      this.type,
      this.id,
      this.maxDurationSlots ?? undefined,
    );
  };
}
