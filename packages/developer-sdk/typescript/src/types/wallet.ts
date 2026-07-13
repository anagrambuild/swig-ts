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

export interface WalletReadArgs {
  network?: Network;
}

export interface ListSwigTokenTransactionsArgs extends WalletReadArgs {
  limit?: number;
}

export interface SwigUsdBalance {
  swigConfigAddress: string;
  walletAddress: string;
  usdValue: number;
}

export interface SwigUsdBalanceWire {
  swig_config_address?: string;
  swigConfigAddress?: string;
  wallet_address?: string;
  walletAddress?: string;
  usd_value?: number;
  usdValue?: number;
}

export interface SwigTokenBalance {
  mintAddress: string;
  tokenProgram: number;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
  amountRaw: string;
  uiAmount: number;
  usdPrice: number;
  usdValue: number;
}

export interface SwigTokenBalanceWire {
  mint_address?: string;
  mintAddress?: string;
  token_program?: number;
  tokenProgram?: number;
  token_symbol?: string;
  tokenSymbol?: string;
  token_name?: string;
  tokenName?: string;
  decimals?: number;
  amount_raw?: string;
  amountRaw?: string;
  ui_amount?: number;
  uiAmount?: number;
  usd_price?: number;
  usdPrice?: number;
  usd_value?: number;
  usdValue?: number;
}

export interface ListSwigTokenBalancesResult {
  swigConfigAddress: string;
  walletAddress: string;
  balances: SwigTokenBalance[];
  totalUsdValue: number;
}

export interface ListSwigTokenBalancesWire {
  swig_config_address?: string;
  swigConfigAddress?: string;
  wallet_address?: string;
  walletAddress?: string;
  balances?: SwigTokenBalanceWire[];
  total_usd_value?: number;
  totalUsdValue?: number;
}

export type SwigTokenTransactionDirection = 'inflow' | 'outflow';

export type SwigTokenTransactionDirectionWire =
  | SwigTokenTransactionDirection
  | 'SWIG_TOKEN_TRANSACTION_DIRECTION_INFLOW'
  | 'SWIG_TOKEN_TRANSACTION_DIRECTION_OUTFLOW'
  | number;

export interface SwigTokenTransaction {
  transactionSignature: string;
  slot: number;
  blockTime?: string;
  ownerAddress: string;
  walletAddress: string;
  isSubaccount: boolean;
  tokenAccountAddress: string;
  mintAddress: string;
  tokenProgram: number;
  direction: SwigTokenTransactionDirection;
  amountRaw: string;
  decimals: number;
  uiAmount: number;
  usdPrice: number;
  usdValue: number;
  tokenSymbol: string;
  tokenName: string;
}

export interface SwigTokenTransactionWire {
  transaction_signature?: string;
  transactionSignature?: string;
  slot?: number | string;
  block_time?: string;
  blockTime?: string;
  owner_address?: string;
  ownerAddress?: string;
  wallet_address?: string;
  walletAddress?: string;
  is_subaccount?: boolean;
  isSubaccount?: boolean;
  token_account_address?: string;
  tokenAccountAddress?: string;
  mint_address?: string;
  mintAddress?: string;
  token_program?: number;
  tokenProgram?: number;
  direction?: SwigTokenTransactionDirectionWire;
  amount_raw?: string;
  amountRaw?: string;
  decimals?: number;
  ui_amount?: number;
  uiAmount?: number;
  usd_price?: number;
  usdPrice?: number;
  usd_value?: number;
  usdValue?: number;
  token_symbol?: string;
  tokenSymbol?: string;
  token_name?: string;
  tokenName?: string;
}

export interface ListSwigTokenTransactionsResult {
  swigConfigAddress: string;
  walletAddress: string;
  transactions: SwigTokenTransaction[];
}

export interface ListSwigTokenTransactionsWire {
  swig_config_address?: string;
  swigConfigAddress?: string;
  wallet_address?: string;
  walletAddress?: string;
  transactions?: SwigTokenTransactionWire[];
}
