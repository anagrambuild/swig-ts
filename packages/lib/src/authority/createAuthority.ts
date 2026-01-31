import { secp256k1 } from '@noble/curves/secp256k1';
import {
  AuthorityType,
  getCreateSecp256k1SessionDecoder,
  getCreateSecp256k1SessionEncoder,
  getCreateSecp256r1SessionEncoder,
  getEd25519SessionEncoder,
  getProgramExecEncoder,
  getProgramExecSessionEncoder,
  getSecp256k1SessionEncoder,
} from '@swig-wallet/coder';
import { SolPublicKey, type SolPublicKeyData } from '../solana';
import { detectPubkeyFormat, getUnprefixedSecpBytes } from '../utils';
import type { Authority } from './abstract';
import { Ed25519Authority, Ed25519SessionAuthority } from './ed25519';
import {
  ProgramExecAuthority,
  ProgramExecSessionAuthority,
} from './programexec';
import { Secp256k1Authority, Secp256k1SessionAuthority } from './secp256k1';
import { Secp256r1Authority, Secp256r1SessionAuthority } from './secp256r1';

export type WriteOnlyAuthority = Authority;

export interface CreateAuthorityInfo {
  data: Uint8Array;
  type: AuthorityType;
}

export function createEd25519AuthorityInfo(
  publicKey: SolPublicKeyData,
): CreateAuthorityInfo {
  const data = new SolPublicKey(publicKey).toBytes();
  const type = AuthorityType.Ed25519;
  return { data, type };
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
  return { data, type };
}

/**
 * Creates authority info for secp256k1 public key
 * @param publicKey Compressed (33 bytes with 0x02/0x03 prefix or 32 bytes without prefix) or uncompressed (65 bytes with 0x04 prefix or 64 bytes without prefix) public key as bytes or hex string
 * @returns CreateAuthorityInfo
 */
export function createSecp256k1AuthorityInfo(
  publicKey: string | Uint8Array,
): CreateAuthorityInfo {
  const format = detectPubkeyFormat(publicKey);

  if (format === 'invalid') {
    throw new Error(
      'Invalid secp256k1 public key format. Expected 33-byte compressed or 64-byte uncompressed key.',
    );
  }

  // Normalize to uncompressed format for internal processing
  const data = getUnprefixedSecpBytes(
    publicKey,
    format === 'compressed' ? 33 : 64,
  );

  const type = AuthorityType.Secp256k1;

  return { data, type };
}

/**
 * Creates session authority info for secp256k1 public key
 * @param publicKey Compressed (33 bytes with 0x02/0x03 prefix or 32 bytes without prefix) or uncompressed (65 bytes with 0x04 prefix or 64 bytes without prefix) public key as bytes or hex string
 * @param maxSessionDuration Maximum session duration in seconds
 * @param sessionKey Optional session key
 * @returns CreateAuthorityInfo
 */
export function createSecp256k1SessionAuthorityInfo(
  publicKey: string | Uint8Array,
  maxSessionDuration: bigint,
  sessionKey?: SolPublicKeyData,
): CreateAuthorityInfo {
  const format = detectPubkeyFormat(publicKey);

  if (format === 'invalid') {
    throw new Error(
      'Invalid secp256k1 public key format. Expected 33-byte compressed or 64-byte uncompressed key.',
    );
  }

  // sanitise the publickey based on the format
  const sanitisedPublicKey = getUnprefixedSecpBytes(
    publicKey,
    format === 'compressed' ? 33 : 64,
  );
  const publicKeyBytes = new Uint8Array(64);
  publicKeyBytes.set(sanitisedPublicKey);

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

  return { data, type };
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
  const d = new Uint8Array(40);
  d.set(data);

  return { data, type };
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

  return { data, type };
}

/**
 * Creates authority info for a ProgramExec authority.
 *
 * @param programId The program ID that must execute the preceding instruction (32 bytes)
 * @param instructionPrefix The instruction data prefix to match (up to 40 bytes)
 * @returns CreateAuthorityInfo
 */
export function createProgramExecAuthorityInfo(
  programId: Uint8Array,
  instructionPrefix: Uint8Array,
): CreateAuthorityInfo {
  // Pad instruction prefix to 40 bytes
  const paddedPrefix = new Uint8Array(40);
  paddedPrefix.set(instructionPrefix.slice(0, 40));

  const authorityData = getProgramExecEncoder().encode({
    programId,
    instructionPrefixLen: Math.min(instructionPrefix.length, 40),
    instructionPrefix: paddedPrefix,
  });

  return {
    data: Uint8Array.from(authorityData),
    type: AuthorityType.ProgramExec,
  };
}

/**
 * Creates authority info for a ProgramExecSession authority.
 *
 * @param programId The program ID that must execute the preceding instruction (32 bytes)
 * @param instructionPrefix The instruction data prefix to match (up to 40 bytes)
 * @param maxSessionDuration Maximum session duration in slots
 * @param sessionKey Optional session key (defaults to zeroed key)
 * @returns CreateAuthorityInfo
 */
export function createProgramExecSessionAuthorityInfo(
  programId: Uint8Array,
  instructionPrefix: Uint8Array,
  maxSessionDuration: bigint,
  sessionKey?: SolPublicKeyData,
): CreateAuthorityInfo {
  // Pad instruction prefix to 40 bytes
  const paddedPrefix = new Uint8Array(40);
  paddedPrefix.set(instructionPrefix.slice(0, 40));

  // Use the full session encoder which includes currentSessionExpiration
  const sessionData = getProgramExecSessionEncoder().encode({
    programId,
    instructionPrefixLen: Math.min(instructionPrefix.length, 40),
    instructionPrefix: paddedPrefix,
    sessionKey: sessionKey
      ? new SolPublicKey(sessionKey).toBytes()
      : Uint8Array.from(Array(32)),
    maxSessionLength: maxSessionDuration,
    currentSessionExpiration: 0n, // Set to 0 for new authorities
  });

  return {
    data: Uint8Array.from(sessionData),
    type: AuthorityType.ProgramExecSession,
  };
}

/**
 * Creates authority info for any authority type.
 * Delegates to the appropriate create*AuthorityInfo function based on type.
 *
 * @param type The authority type
 * @param id The authority identifier (public key bytes)
 * @param maxDurationSlots Maximum session duration in slots (required for session types)
 * @param sessionKey Optional session key for session authorities
 * @returns CreateAuthorityInfo
 */
export function getCreateAuthorityInfo(
  type: AuthorityType,
  id: Uint8Array,
  maxDurationSlots?: bigint,
  sessionKey?: SolPublicKeyData,
): CreateAuthorityInfo {
  if (type === AuthorityType.Ed25519) {
    return createEd25519AuthorityInfo(id);
  }
  if (type === AuthorityType.Ed25519Session) {
    if (maxDurationSlots === undefined) {
      throw new Error('Session authority requires maxDurationSlots');
    }
    return createEd25519SessionAuthorityInfo(
      id,
      maxDurationSlots,
      sessionKey ? new SolPublicKey(sessionKey) : undefined,
    );
  }
  if (type === AuthorityType.Secp256k1) {
    return createSecp256k1AuthorityInfo(id);
  }
  if (type === AuthorityType.Secp256k1Session) {
    if (maxDurationSlots === undefined) {
      throw new Error('Session authority requires maxDurationSlots');
    }
    return createSecp256k1SessionAuthorityInfo(
      id,
      maxDurationSlots,
      sessionKey,
    );
  }
  if (type === AuthorityType.Secp256r1) {
    return createSecp256r1AuthorityInfo(id);
  }
  if (type === AuthorityType.Secp256r1Session) {
    if (maxDurationSlots === undefined) {
      throw new Error('Session authority requires maxDurationSlots');
    }
    return createSecp256r1SessionAuthorityInfo(
      id,
      maxDurationSlots,
      sessionKey,
    );
  }
  throw new Error(`Unsupported authority type: ${type}`);
}

/////////////////////////
/// Mock Authority
/////////////////////////

export function getMockAuthorityFromCreateAuthorityInfo(
  info: CreateAuthorityInfo,
): Authority {
  if (info.type === AuthorityType.Ed25519) {
    return new Ed25519Authority(info.data);
  }

  if (info.type === AuthorityType.Ed25519Session) {
    return new Ed25519SessionAuthority(info.data);
  }

  if (info.type === AuthorityType.Secp256k1) {
    const uncompressedPublicKey = new Uint8Array(65);
    uncompressedPublicKey.set([4]);
    uncompressedPublicKey.set(info.data, 1);

    const d = new Uint8Array(40);
    d.set(
      secp256k1.ProjectivePoint.fromHex(uncompressedPublicKey).toRawBytes(true),
    );

    return new Secp256k1Authority(d);
  }

  if (info.type === AuthorityType.Secp256k1Session) {
    const sessionData = getCreateSecp256k1SessionDecoder().decode(info.data);

    const uncompressedPublicKey = new Uint8Array(65);
    uncompressedPublicKey.set([4]);
    uncompressedPublicKey.set(info.data, 1);

    const mockAuthorityData = getSecp256k1SessionEncoder().encode({
      currentSessionExpiration: 0n,
      maxSessionLength: sessionData.maxSessionLength,
      odometer: 0,
      sessionKey: sessionData.sessionKey,
      publicKey: secp256k1.ProjectivePoint.fromHex(
        uncompressedPublicKey,
      ).toRawBytes(true),
    });
    return new Secp256k1SessionAuthority(new Uint8Array(mockAuthorityData));
  }

  if (info.type === AuthorityType.Secp256r1) {
    const d = new Uint8Array(40);
    d.set(info.data);
    return new Secp256r1Authority(d);
  }

  if (info.type === AuthorityType.Secp256r1Session) {
    return new Secp256r1SessionAuthority(info.data);
  }

  if (info.type === AuthorityType.ProgramExec) {
    return new ProgramExecAuthority(info.data);
  }

  if (info.type === AuthorityType.ProgramExecSession) {
    return new ProgramExecSessionAuthority(info.data);
  }

  throw new Error('Error creating mock authority from CreateAuthorityInfo');
}
