import { PublicKey } from '@solana/web3.js';
import {
  AuthorityType,
  getCreateSecp256k1SessionEncoder,
  getCreateSecp256r1SessionEncoder,
  getEd25519SessionEncoder,
} from '@swig-wallet/coder';
import { getUnprefixedSecpBytes } from '../utils';

export type AuthorityCreateInfo = { data: Uint8Array; type: AuthorityType };

export interface CreateAuthorityInfo {
  createAuthorityInfo: AuthorityCreateInfo;
}

/**
 * Create an AuthorityInfo object for a standard Ed25519 authority.
 *
 * @param publicKey Solana PublicKey
 * @returns The encoded authority data and authority type.
 */
export function createEd25519AuthorityInfo(
  publicKey: PublicKey,
): CreateAuthorityInfo {
  const data = publicKey.toBytes();
  const type = AuthorityType.Ed25519;
  return { createAuthorityInfo: { data, type } };
}

/**
 * Create an AuthorityInfo object for an Ed25519 session authority.
 *
 * @param publicKey Solana PublicKey for the authority
 * @param maxSessionDuration Number of slots the session is valid for
 * @param sessionKey Optional session key (defaults to zeroed key)
 * @returns The encoded session authority data and authority type.
 */
export function createEd25519SessionAuthorityInfo(
  publicKey: PublicKey,
  maxSessionDuration: bigint,
  sessionKey?: PublicKey,
): CreateAuthorityInfo {
  const sessionData = getEd25519SessionEncoder().encode({
    publicKey: publicKey.toBytes(),
    sessionKey: sessionKey ? sessionKey.toBytes() : Uint8Array.from(Array(32)),
    currentSessionExpiration: 0n,
    maxSessionLength: maxSessionDuration,
  });
  const data = Uint8Array.from(sessionData.slice(0, 72));
  const type = AuthorityType.Ed25519Session;

  return { createAuthorityInfo: { data, type } };
}

/**
 * Create an AuthorityInfo object for a basic Secp256k1 authority.
 *
 * @param publicKey Uncompressed public key (64 bytes) as Uint8Array or hex string.
 * @returns The encoded authority data and authority type.
 */
export function createSecp256k1AuthorityInfo(
  publicKey: string | Uint8Array,
): CreateAuthorityInfo {
  const data = getUnprefixedSecpBytes(publicKey, 64);
  const type = AuthorityType.Secp256k1;

  return { createAuthorityInfo: { data, type } };
}

/**
 * Create an AuthorityInfo object for a Secp256k1 session authority.
 *
 * @param publicKey Uncompressed public key (64 bytes) as Uint8Array or hex string.
 * @param maxSessionDuration Number of slots the session is valid for
 * @param sessionKey Optional session key (defaults to zeroed key)
 * @returns The encoded session authority data and authority type.
 */
export function createSecp256k1SessionAuthorityInfo(
  publicKey: string | Uint8Array,
  maxSessionDuration: bigint,
  sessionKey?: PublicKey,
): CreateAuthorityInfo {
  const publicKeyBytes = getUnprefixedSecpBytes(publicKey, 64);

  const sessionData = getCreateSecp256k1SessionEncoder().encode({
    publicKey: publicKeyBytes,
    sessionKey: sessionKey ? sessionKey.toBytes() : Uint8Array.from(Array(32)),
    maxSessionLength: maxSessionDuration,
  });

  const data = Uint8Array.from(sessionData);
  const type = AuthorityType.Secp256k1Session;

  return { createAuthorityInfo: { data, type } };
}

/**
 * Create an AuthorityInfo object for a basic Secp256r1 authority.
 *
 * @param publicKey Compressed public key (33 bytes) as Uint8Array or hex string.
 * @returns The encoded authority data and authority type.
 */
export function createSecp256r1AuthorityInfo(
  publicKey: string | Uint8Array,
): CreateAuthorityInfo {
  const data = getUnprefixedSecpBytes(publicKey, 33);
  const type = AuthorityType.Secp256r1;

  return { createAuthorityInfo: { data, type } };
}

/**
 * Create an AuthorityInfo object for a Secp256r1 session authority.
 *
 * @param publicKey Compressed public key (33 bytes) as Uint8Array or hex string.
 * @param maxSessionDuration Number of slots the session is valid for
 * @param sessionKey Optional session key (defaults to zeroed key)
 * @returns The encoded session authority data and authority type.
 */
export function createSecp256r1SessionAuthorityInfo(
  publicKey: string | Uint8Array,
  maxSessionDuration: bigint,
  sessionKey?: PublicKey,
): CreateAuthorityInfo {
  const publicKeyBytes = getUnprefixedSecpBytes(publicKey, 33);

  const sessionData = getCreateSecp256r1SessionEncoder().encode({
    publicKey: publicKeyBytes,
    sessionKey: sessionKey ? sessionKey.toBytes() : Uint8Array.from(Array(32)),
    maxSessionLength: maxSessionDuration,
  });

  const data = Uint8Array.from(sessionData);
  const type = AuthorityType.Secp256r1Session;

  return { createAuthorityInfo: { data, type } };
}
