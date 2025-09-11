import { PublicKey } from '@solana/web3.js';
import { isWeb3PublicKey, type SolPublicKeyData } from '@swig-wallet/lib';

export function toPublicKey(solPublicKeyData: SolPublicKeyData): PublicKey {
  if (isWeb3PublicKey(solPublicKeyData)) {
    return new PublicKey(solPublicKeyData.toBytes());
  }
  return new PublicKey(solPublicKeyData);
}
