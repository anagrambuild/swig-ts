import type { Address } from '@solana/kit';

export interface RegisterAccountRequest {
  swigAddress: string;
  walletAddress: string;
  userAddress: string;
  managerAddress: string;
}

export interface TransferRequest {
  amount: number;
}

export interface AccountResponse {
  id: string;
  swigAddress: string;
  walletAddress: string;
  userAddress: string;
  managerAddress: string;
  balance?: number;
}
