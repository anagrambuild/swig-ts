import { AuthorityType } from '@swig-wallet/coder';
import type { Authority } from './abstract';
import { Ed25519Authority, Ed25519SessionAuthority } from './ed25519';
import { Secp256k1Authority, Secp256k1SessionAuthority } from './secp256k1';
import { Secp256r1Authority, Secp256r1SessionAuthority } from './secp256r1';

/**
 * Get a parsed authority from the authority raw bytes.
 * @param type AuthorityType
 * @param data Authority raw bytes
 * @param [roleId] Role ID
 * @returns Parsed authority
 */
export function getAuthority(type: AuthorityType, data: Uint8Array): Authority {
  if (type === AuthorityType.Ed25519) {
    return new Ed25519Authority(data);
  }

  if (type === AuthorityType.Ed25519Session) {
    return new Ed25519SessionAuthority(data);
  }

  if (type === AuthorityType.Secp256k1) {
    return new Secp256k1Authority(data);
  }

  if (type === AuthorityType.Secp256k1Session) {
    return new Secp256k1SessionAuthority(data);
  }

  if (type === AuthorityType.Secp256r1) {
    return new Secp256r1Authority(data);
  }

  if (type === AuthorityType.Secp256r1Session) {
    return new Secp256r1SessionAuthority(data);
  }

  throw new Error('Invalid authority');
}

/**
 * `getAuthority` with enforced Role ID.
 * @param type AuthorityType
 * @param data Authority raw bytes
 * @param roleId Role ID
 * @returns Parsed authority
 */
export function getRoleAuthority(
  type: AuthorityType,
  data: Uint8Array,
): Authority {
  return getAuthority(type, data);
}
