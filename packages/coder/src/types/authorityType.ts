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
 * Represents the type of cryptographic authority used to authenticate actions on a Swig account.
 */
export enum AuthorityType {
  /**
   * No authority. Used as a placeholder or uninitialized value.
   */
  None,

  /**
   * Standard Ed25519 public key-based authority.
   */
  Ed25519 = 1,

  /**
   * A session-based Ed25519 authority with an expiration mechanism.
   * Allows short-lived sessions to be derived from a main Ed25519 credential for performance and security.
   */
  Ed25519Session,

  /**
   * Standard Secp256k1 public key-based authority (commonly used in Ethereum).
   */
  Secp256k1,

  /**
   * A session-based Secp256k1 authority with expiration.
   * Useful for deriving temporary keys from a main Secp256k1 wallet (e.g., for transaction batching or short-lived app sessions).
   */
  Secp256k1Session,

  // /**
  //  * A session-based Secp256r1 authority with expiration.
  //  * Not yet implemented.
  //  */
  // Secp256r1Session,

  // /**
  //  * A session-based authority using a Groth16 zero-knowledge proof.
  //  * The session is authorized only if the provided ZK circuit proof is valid.
  //  * Not yet implemented.
  //  */
  // Groth16Session,
}

/**
 * Returns an encoder for the `AuthorityType` enum using a 16-bit unsigned integer.
 */
export function getAuthorityTypeEncoder(): Encoder<AuthorityType> {
  return getEnumEncoder(AuthorityType, { size: getU16Encoder() });
}

/**
 * Returns a decoder for the `AuthorityType` enum using a 16-bit unsigned integer.
 */
export function getAuthorityTypeDecoder(): Decoder<AuthorityType> {
  return getEnumDecoder(AuthorityType, { size: getU16Decoder() });
}

/**
 * Returns a codec that can encode and decode `AuthorityType` values.
 */
export function getAuthorityTypeCodec(): Codec<AuthorityType, AuthorityType> {
  return combineCodec(getAuthorityTypeEncoder(), getAuthorityTypeDecoder());
}
