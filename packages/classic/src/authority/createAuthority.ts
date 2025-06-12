import { PublicKey } from '@solana/web3.js';
import {
  AuthorityType,
  getCreateSecp256k1SessionEncoder,
  getEd25519SessionEncoder,
} from '@swig-wallet/coder';
import { getUnprefixedSecpBytes } from '../utils';

export type AuthorityCreateInfo = { data: Uint8Array; type: AuthorityType };

export interface CreateAuthorityInfo {
  createAuthorityInfo: AuthorityCreateInfo;
}

export function createEd25519AuthorityInfo(
  publicKey: PublicKey,
): CreateAuthorityInfo {
  const data = publicKey.toBytes();
  const type = AuthorityType.Ed25519;
  return { createAuthorityInfo: { data, type } };
}

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
 *
 * @param publicKey Uncomporesed Publickey bytes or Hex string
 * @returns
 */
export function createSecp256k1AuthorityInfo(
  publicKey: string | Uint8Array,
): CreateAuthorityInfo {
  const data = getUnprefixedSecpBytes(publicKey, 64);
  const type = AuthorityType.Secp256k1;

  return { createAuthorityInfo: { data, type } };
}

/**
 *
 * @param publicKey Uncomporesed Publickey bytes or Hex string
 * @returns
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
