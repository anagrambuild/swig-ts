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
  authFlow?: 'session' | 'role';
  updatedAt?: number;
  requesterAuthority?: WalletAuthority;
  authorityPublicKey?: string;
  /**
   * Present on persisted IdP sessions. Local proxy handlers can use it to
   * resolve requester authority server-side.
   */
  roleId?: number;
}

export interface WalletHandleOptions {
  network?: Network;
  requesterAuthority?: WalletAuthority;
}
