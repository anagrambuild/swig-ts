import type { Network } from './common.js';

export interface WalletAddressInfo {
  swigConfigAddress: string;
  walletAddress: string;
}

export interface WalletReference {
  swigConfigAddress: string;
  walletAddress?: string;
  network?: Network;
  requesterPubkey?: string;
}

export interface IdpWalletSession {
  configAddress: string;
  walletAddress: string;
  requesterPubkey?: string;
  authorityPublicKey?: string;
  /**
   * Deprecated. The transaction API resolves the requester's role on-chain.
   */
  roleId?: number;
}

export interface WalletHandleOptions {
  network?: Network;
  requesterPubkey?: string;
}
