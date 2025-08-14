import { secp256k1 } from '@noble/curves/secp256k1';
import {
  AuthorityType,
  getCreateSecp256k1SessionEncoder,
  getCreateSecp256r1SessionEncoder,
  getEd25519SessionEncoder,
  getSecp256k1SessionEncoder,
} from '@swig-wallet/coder';
import { SolPublicKey, type SolPublicKeyData } from '../solana';
import { getUnprefixedSecpBytes } from '../utils';
import type { Authority } from './abstract';
import { Ed25519Authority, Ed25519SessionAuthority } from './ed25519';
import { Secp256k1SessionAuthority } from './secp256k1';
import { Secp256r1Authority, Secp256r1SessionAuthority } from './secp256r1';

export type WriteOnlyAuthority = Authority;

export interface CreateAuthorityInfo {
  data: Uint8Array;
  type: AuthorityType;
  writeOnlyAuthority: WriteOnlyAuthority;
}

export function createEd25519AuthorityInfo(
  publicKey: SolPublicKeyData,
): CreateAuthorityInfo {
  const data = new SolPublicKey(publicKey).toBytes();
  const type = AuthorityType.Ed25519;
  const writeOnlyAuthority = new Ed25519Authority(data);
  return { data, type, writeOnlyAuthority };
}

export function createEd25519SessionAuthorityInfo(
  publicKey: SolPublicKeyData,
  maxSessionDuration: bigint,
  sessionKey?: SolPublicKey,
): CreateAuthorityInfo {
  const sessionData = getEd25519SessionEncoder().encode({
    publicKey: new SolPublicKey(publicKey).toBytes(),
    sessionKey: sessionKey ? sessionKey.toBytes() : Uint8Array.from(Array(32)),
    currentSessionExpiration: 0n,
    maxSessionLength: maxSessionDuration,
  });
  const data = Uint8Array.from(sessionData.slice(0, 72));
  const type = AuthorityType.Ed25519Session;
  const writeOnlyAuthority = new Ed25519SessionAuthority(data);

  return { data, type, writeOnlyAuthority };
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

  const writeOnlyAuthority = new Secp256k1SessionAuthority(
    new Uint8Array(secp256k1.ProjectivePoint.fromHex(data).toRawBytes(true)),
  );

  return { data, type, writeOnlyAuthority };
}

/**
 *
 * @param publicKey Uncomporesed Publickey bytes or Hex string
 * @returns
 */
export function createSecp256k1SessionAuthorityInfo(
  publicKey: string | Uint8Array,
  maxSessionDuration: bigint,
  sessionKey?: SolPublicKeyData,
): CreateAuthorityInfo {
  const publicKeyBytes = getUnprefixedSecpBytes(publicKey, 64);

  const _sessionKey = sessionKey
    ? new SolPublicKey(sessionKey).toBytes()
    : Uint8Array.from(Array(32));

  const sessionData = getCreateSecp256k1SessionEncoder().encode({
    publicKey: publicKeyBytes,
    sessionKey: _sessionKey,
    maxSessionLength: maxSessionDuration,
  });

  const data = Uint8Array.from(sessionData);
  const type = AuthorityType.Secp256k1Session;
  const mockAuthorityData = getSecp256k1SessionEncoder().encode({
    currentSessionExpiration: 0n,
    maxSessionLength: maxSessionDuration,
    odometer: 0,
    sessionKey: _sessionKey,
    publicKey:
      secp256k1.ProjectivePoint.fromHex(publicKeyBytes).toRawBytes(true),
  });
  const writeOnlyAuthority = new Secp256k1SessionAuthority(
    new Uint8Array(mockAuthorityData),
  );

  return { data, type, writeOnlyAuthority };
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
  const writeOnlyAuthority = new Secp256r1Authority(data);

  return { data, type, writeOnlyAuthority };
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
  sessionKey?: SolPublicKeyData,
): CreateAuthorityInfo {
  const publicKeyBytes = getUnprefixedSecpBytes(publicKey, 33);

  const sessionData = getCreateSecp256r1SessionEncoder().encode({
    publicKey: publicKeyBytes,
    sessionKey: sessionKey
      ? new SolPublicKey(sessionKey).toBytes()
      : Uint8Array.from(Array(32)),
    maxSessionLength: maxSessionDuration,
  });

  const data = Uint8Array.from(sessionData);
  const type = AuthorityType.Secp256r1Session;

  const writeOnlyAuthority = new Secp256r1SessionAuthority(
    new Uint8Array(sessionData),
  );

  return { data, type, writeOnlyAuthority };
}
