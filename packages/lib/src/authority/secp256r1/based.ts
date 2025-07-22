import type { Authority } from '../abstract';

export interface Secp256r1BasedAuthority {
  /**
   * 33-byte Secp256r1 compressed publickey bytes
   */
  secp256r1PublicKey: Uint8Array;
}

export function isSecp256r1BasedAuthority(
  authority: Authority,
): authority is Authority & Secp256r1BasedAuthority {
  return 'secp256r1PublicKey' in authority;
}

export function getSecp256r1BasedAuthority(authority: Authority) {
  if (!isSecp256r1BasedAuthority(authority)) return null;
  return authority;
}
