import { PublicKey } from '@solana/web3.js';
import { SolPublicKey, type SolPublicKeyData } from '@swig-wallet/lib';

export function toPublicKey(solPublicKeyData: SolPublicKeyData): PublicKey {
  const publicKeyBytes = new SolPublicKey(solPublicKeyData).toBytes();
  return new PublicKey(publicKeyBytes);
}
