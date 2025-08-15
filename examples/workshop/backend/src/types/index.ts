import type { Address } from '@solana/kit';

export interface RegisteredAccount {
  swigAddress: Address;
  userAddress: Address;
  id: string;
  balance: number;
  registeredAt: string;
  lastAction?: string;
}

export interface RegisterAccountRequest {
  swigAddress: string;
  userAddress: string;
  id: string;
}

export interface RegisterAccountResponse {
  success: boolean;
  message: string;
}

export interface TriggerActionRequest {
  swigAddress: string;
  action: string;
}

export interface TriggerActionResponse {
  success: boolean;
  transactionSignature?: string;
  message: string;
}

export interface StatusResponse {
  accounts: RegisteredAccount[];
  totalAccounts: number;
  jobsRunning: boolean;
}

export interface BackendAddressResponse {
  success: boolean;
  backendAddress?: string;
  message?: string;
}
