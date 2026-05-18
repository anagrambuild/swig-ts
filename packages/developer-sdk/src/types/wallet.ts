import type { Network } from './common.js';
import type { WalletAuthority } from './wallet-actions.js';

export interface WalletAddressInfo {
  swigConfigAddress: string;
  walletAddress: string;
}

export interface WalletReference {
  swigConfigAddress: string;
  walletAddress?: string;
  network?: Network;
  requesterAuthority?: WalletAuthority;
}

export interface IdpWalletSession {
  configAddress: string;
  walletAddress: string;
  requesterAuthority?: WalletAuthority;
  authorityPublicKey?: string;
  /**
   * Deprecated. The transaction API resolves the requester's role on-chain.
   */
  roleId?: number;
}

export interface WalletHandleOptions {
  network?: Network;
  requesterAuthority?: WalletAuthority;
}
