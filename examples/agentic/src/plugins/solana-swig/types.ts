import { Keypair } from '@solana/web3.js';

export interface SolanaWalletInfo {
  publicKey: string;
  balance: number;
  keypair?: Keypair;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
}

export interface SwigWalletInfo {
  address: string;
  balance: number;
  tokens: TokenBalance[];
}

export interface TransferParams {
  to: string;
  amount: number;
  mint?: string; // For SPL tokens
}

export interface SwigTransferParams {
  swigAddress: string;
  to: string;
  amount: number;
  mint?: string;
}

export interface AirdropParams {
  amount: number;
}

export interface MintTokenParams {
  decimals: number;
  initialSupply: number;
  name?: string;
  symbol?: string;
}

export interface SolanaConfig {
  rpcUrl: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}
