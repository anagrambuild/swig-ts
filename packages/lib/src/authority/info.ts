/**
 * AuthorityInfo - A lightweight wrapper around authority data.
 *
 * Provides typed access to authority properties and conversion to
 * CreateAuthorityInfo for wallet operations.
 *
 * @packageDocumentation
 */

import { AuthorityType } from '@swig-wallet/coder';
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
