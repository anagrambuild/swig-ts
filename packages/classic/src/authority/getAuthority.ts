import { AuthorityType } from '@swig-wallet/coder';
import type { Authority } from './abstract';
import { Ed25519Authority, Ed25519SessionAuthority } from './ed25519';
import { Secp256k1Authority, Secp256k1SessionAuthority } from './secp256k1';

/**
 * Get a parsed authority from the authority raw bytes.
 * @param type AuthorityType
 * @param data Authority raw bytes
 * @param [roleId] Role ID
 * @returns Parsed authority
 */
export function getAuthority(
  type: AuthorityType,
  data: Uint8Array,
  roleId?: number,
): Authority {
  if (type === AuthorityType.Ed25519) {
    return new Ed25519Authority(data, roleId);
  }

  if (type === AuthorityType.Ed25519Session) {
    return new Ed25519SessionAuthority(data, roleId);
  }

  if (type === AuthorityType.Secp256k1) {
    return new Secp256k1Authority(data, roleId);
  }

  if (type === AuthorityType.Secp256k1Session) {
    return new Secp256k1SessionAuthority(data, roleId);
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
  roleId: number,
): Authority {
  return getAuthority(type, data, roleId);
}
