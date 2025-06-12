import {
  combineCodec,
  getEnumDecoder,
  getEnumEncoder,
  getU16Decoder,
  getU16Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';

/**
 * Defines different types of permissions that can be granted to an authority in a Swig account.
 */
export enum Permission {
  /**
   * No permission granted.
   */
  None,

  /**
   * Allows a one-time transfer of a specified amount of SOL.
   */
  SolLimit = 1,

  /**
   * Allows recurring SOL transfers up to a specified limit within a defined window (e.g., monthly).
   * Useful for subscriptions or automated payments.
   */
  SolRecurringLimit,

  /**
   * Grants permission to sign on behalf of the Swig account for a specific program.
   */
  Program,

  /**
   * Grants permission to act within the custom-defined ownership model of a specific program.
   * Useful for developers implementing bespoke logic (e.g., NFTs, custom token programs).
   */
  ProgramScope,

  /**
   * Allows a one-time transfer of a specific SPL token up to a set limit.
   */
  TokenLimit,

  /**
   * Allows recurring transfers of specific SPL tokens up to a limit within a time window.
   * Enables token-based subscriptions or allowances.
   */
  TokenRecurringLimit,

  /**
   * Grants all available permissions. Use with caution.
   */
  All,

  /**
   * Grants the ability to manage other authorities and their permissions.
   */
  ManageAuthority,

  /**
   * Allows an authority to create a single sub-account with unrestricted access.
   * This is useful when a user wants an app to manage all funds independently,
   * without giving it access to the main wallet. Common in automated portfolio management.
   */
  SubAccount,
  StakeLimit,
  StakeRecurringLimit,
  StakeAll,
}

/**
 * Returns an encoder for the `Permission` enum using a 16-bit unsigned integer.
 */
export function getPermissionEncoder(): Encoder<Permission> {
  return getEnumEncoder(Permission, { size: getU16Encoder() });
}

/**
 * Returns a decoder for the `Permission` enum using a 16-bit unsigned integer.
 */
export function getPermissionDecoder(): Decoder<Permission> {
  return getEnumDecoder(Permission, { size: getU16Decoder() });
}

/**
 * Returns a codec that can encode and decode `Permission` values.
 */
export function getPermissionCodec(): Codec<Permission, Permission> {
  return combineCodec(getPermissionEncoder(), getPermissionDecoder());
}
