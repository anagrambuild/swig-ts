import { Keypair } from '@solana/web3.js';
import { findSwigPda } from '@swig-wallet/classic';
import PAYER_KEYPAIR from '../../test-validator/keys/payer.json';
import { SwigIdStore } from './session';

export const payerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(PAYER_KEYPAIR),
);

export function getSwigAddress() {
  const swigId = SwigIdStore.getId();
  const [swigAddress] = findSwigPda(swigId);
  
  return { swigId, swigAddress };
}
