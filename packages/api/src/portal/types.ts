import type { Network } from '../types.js';

/**
 * Wallet authority types that can be passed directly when creating a wallet.
 * Uses UPPER_SNAKE_CASE format matching the portal's Prisma enum.
 */
export type WalletType =
  | 'ED25519'
  | 'ED25519_SESSION'
  | 'SECP256K1'
  | 'SECP256K1_SESSION'
  | 'SECP256R1'
  | 'SECP256R1_SESSION';

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
  | { type: 'CloseSwigAuthority' }
  | { type: 'RentDestination' }
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
  /** Optional signer ID to override or provide (alternative to walletAddress + walletType) */
  signerId?: string;
  /**
   * Wallet public key to use as the authority (alternative to signerId).
   * Must be provided together with walletType.
   */
  walletAddress?: string;
  /**
   * Authority type for the wallet (alternative to signerId).
   * Must be provided together with walletAddress.
   */
  walletType?: WalletType;
  /**
   * Maximum session duration in slots (only valid for session authority types).
   * String to safely handle bigint values.
   */
  maxDurationSlots?: string;
  /** Optional swig ID (generated if not provided) */
  swigId?: string;
  /** Network to use ('mainnet' or 'devnet') */
  network: Network;
  /**
   * Paymaster public key.
   * When provided, the paymaster signs and sends the transaction on your behalf.
   * When omitted, the API returns a serialized unsigned transaction for you to
   * sign and send yourself.
   */
  paymasterPubkey?: string;
}

/**
 * Response when a paymaster is used — the transaction has been signed and sent.
 */
export interface CreateWalletPaymasterResponse {
  /** Swig ID (8-byte identifier) */
  swigId: string;
  /** Swig wallet address */
  swigAddress: string;
  /** Transaction signature */
  signature: string;
}

/**
 * Response when no paymaster is provided — the unsigned transaction is returned
 * as a base58-encoded serialized VersionedTransaction.
 */
export interface CreateWalletTransactionResponse {
  /** Swig ID (8-byte identifier) */
  swigId: string;
  /** Swig wallet address */
  swigAddress: string;
  /** Base58-encoded serialized VersionedTransaction (unsigned) */
  transaction: string;
}

/**
 * Union response type for wallet creation.
 * Discriminated by the presence of `signature` (paymaster flow) or `transaction` (self-send flow).
 */
export type CreateWalletResponse =
  | CreateWalletPaymasterResponse
  | CreateWalletTransactionResponse;
