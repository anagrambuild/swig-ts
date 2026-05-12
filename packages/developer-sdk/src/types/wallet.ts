import type { Network } from './common.js';

export interface WalletAddressInfo {
  swigId?: string;
  /**
   * Swig-owned config/metadata account.
   */
  swigConfigAddress: string;
  /**
   * System-owned wallet PDA used as the spendable wallet address.
   */
  walletAddress: string;
}

export interface WalletReference {
  swigId?: string;
  swigConfigAddress: string;
  walletAddress?: string;
  network?: Network;
}

export interface IdpWalletSession {
  configAddress: string;
  walletAddress: string;
  roleId: number;
}

export interface WalletHandleOptions {
  network?: Network;
  roleId?: number;
}
