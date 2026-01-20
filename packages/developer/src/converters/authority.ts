import type { AuthorityConfig } from '@swig-wallet/api';
import {
  AuthorityInfo,
  AuthorityType,
  SolPublicKey,
  detectPubkeyFormat,
  getUnprefixedSecpBytes,
} from '@swig-wallet/lib';

const TYPE_MAP: Record<string, AuthorityType> = {
  Ed25519: AuthorityType.Ed25519,
  Ed25519Session: AuthorityType.Ed25519Session,
  Secp256k1: AuthorityType.Secp256k1,
  Secp256k1Session: AuthorityType.Secp256k1Session,
  Secp256r1: AuthorityType.Secp256r1,
  Secp256r1Session: AuthorityType.Secp256r1Session,
};

export function authorityFromConfig(config: AuthorityConfig): AuthorityInfo {
  const type = TYPE_MAP[config.type];
  if (type === undefined) {
    throw new Error(`Unknown authority type: ${config.type}`);
  }

  let data: Uint8Array;

  if (config.type.startsWith('Ed25519')) {
    data = new SolPublicKey(config.publicKey).toBytes();
  } else if (config.type.startsWith('Secp256k1')) {
    const format = detectPubkeyFormat(config.publicKey);
    if (format === 'invalid') {
      throw new Error(
        'Invalid secp256k1 public key format. Expected 33-byte compressed or 64-byte uncompressed key.',
      );
    }
    data = getUnprefixedSecpBytes(
      config.publicKey,
      format === 'compressed' ? 33 : 64,
    );
  } else {
    data = getUnprefixedSecpBytes(config.publicKey, 33);
  }

  const maxDurationSlots =
    'maxDurationSlots' in config ? BigInt(config.maxDurationSlots) : null;

  return new AuthorityInfo(type, data, maxDurationSlots);
}
