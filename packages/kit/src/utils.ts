import type { Address } from '@solana/kit';
import { SolPublicKey, type SolPublicKeyData } from '@swig-wallet/lib';

export function toAddress(solPublicKeyData: SolPublicKeyData): Address {
  return new SolPublicKey(solPublicKeyData).toAddress();
}
