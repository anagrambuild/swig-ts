import type { Network } from '../types.js';

export type AuthorityConfig =
  | { type: 'Ed25519'; publicKey: string }
  | { type: 'Ed25519Session'; publicKey: string; maxDurationSlots: string }
  | { type: 'Secp256k1'; publicKey: string }
  | { type: 'Secp256k1Session'; publicKey: string; maxDurationSlots: string }
  | { type: 'Secp256r1'; publicKey: string }
  | { type: 'Secp256r1Session'; publicKey: string; maxDurationSlots: string };

export type ActionConfig =
  | { type: 'All' }
  | { type: 'AllButManageAuthority' }
  | { type: 'ManageAuthority' }
  | { type: 'SolLimit'; amount: string }
  | { type: 'SolRecurringLimit'; recurringAmount: string; window: string }
  | { type: 'SolDestinationLimit'; amount: string; destination: string }
  | {
      type: 'SolRecurringDestinationLimit';
      recurringAmount: string;
      window: string;
      destination: string;
    }
  | { type: 'TokenLimit'; mint: string; amount: string }
  | {
      type: 'TokenRecurringLimit';
      mint: string;
      recurringAmount: string;
      window: string;
    }
  | {
      type: 'TokenDestinationLimit';
      mint: string;
      amount: string;
      destination: string;
    }
  | {
      type: 'TokenRecurringDestinationLimit';
      mint: string;
      recurringAmount: string;
      window: string;
      destination: string;
    }
  | { type: 'Program'; programId: string }
  | { type: 'ProgramAll' }
  | { type: 'ProgramCurated' }
  | { type: 'StakeLimit'; amount: string }
  | { type: 'StakeRecurringLimit'; recurringAmount: string; window: string }
  | { type: 'StakeAll' }
  | { type: 'SubAccount' };

export interface Policy {
  /** Unique policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Optional description */
  description: string | null;
  /** Authority configuration (signer) */
  authority: AuthorityConfig | null;
  /** Action configurations (permissions) */
  actions: ActionConfig[];
}

export interface CreateWalletRequest {
  /** Policy ID to use for wallet creation */
  policyId: string;
  /** Optional signer ID to override or provide */
  signerId?: string;
  /** Optional swig ID (generated if not provided) */
  swigId?: string;
  /** Network to use ('mainnet' or 'devnet') */
  network: Network;
  /** Paymaster public key */
  paymasterPubkey: string;
}

export interface CreateWalletResponse {
  /** Swig ID (8-byte identifier) */
  swigId: string;
  /** Swig wallet address */
  swigAddress: string;
  /** Transaction signature */
  signature: string;
}
