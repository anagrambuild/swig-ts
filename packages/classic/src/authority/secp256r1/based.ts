import type { Authority as IAuthority } from '../abstract';

export interface Secp256r1BasedAuthority {
  /**
   * 33-byte Secp256r1 compressed public key bytes
   */
  secp256r1PublicKey: Uint8Array;
  /**
   * Secp256r1 compressed public key string (hex)
   */
  secp256r1PublicKeyString: string;
}

export function isSecp256r1BasedAuthority(
  authority: IAuthority,
): authority is IAuthority & Secp256r1BasedAuthority {
  return (
    'secp256r1PublicKey' in authority && 'secp256r1PublicKeyString' in authority
  );
}

export function getSecp256r1BasedAuthority(authority: IAuthority) {
  if (!isSecp256r1BasedAuthority(authority)) return null;
  return authority;
}
