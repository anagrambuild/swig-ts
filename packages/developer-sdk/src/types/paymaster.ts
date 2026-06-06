import type { Network } from './common.js';

export interface GetPaymasterBalanceArgs {
  network?: Network;
}

export type PaymasterKind = 'api' | 'idp' | 'unspecified';

export type PaymasterKindWire =
  | PaymasterKind
  | 'PAYMASTER_KIND_API'
  | 'PAYMASTER_KIND_IDP'
  | 'PAYMASTER_KIND_UNSPECIFIED'
  | number;

export interface PaymasterBalance {
  configured: boolean;
  kind: PaymasterKind;
  id: string;
  address: string;
  label: string;
  balanceLamports: string;
  balanceSol: number;
}

export interface PaymasterBalanceWire {
  configured?: boolean;
  kind?: PaymasterKindWire;
  id?: string;
  address?: string;
  label?: string;
  balance_lamports?: number | string;
  balanceLamports?: number | string;
  balance_sol?: number;
  balanceSol?: number;
}
