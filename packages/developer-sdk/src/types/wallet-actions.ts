import type { Amount, JsonObject, Network } from './common.js';
import type { SolanaInstructionInput } from './instruction.js';
import type { PreparedTransactionWire } from './transaction.js';
import type { WalletAddressInfo } from './wallet.js';

export interface CreateWalletArgs {
  policyId: string;
  network?: Network;
  label?: string;
  externalId?: string;
  metadata?: JsonObject;
  idempotencyKey?: string;
}

export interface CreateWalletResponse
  extends WalletAddressInfo, PreparedTransactionWire {
  network?: Network;
  label?: string;
  externalId?: string;
}

export interface TransferArgs {
  destination: string;
  amount: Amount;
  /**
   * Omit for native SOL, or pass a mint address for SPL token transfers.
   */
  mint?: string;
  network?: Network;
  idempotencyKey?: string;
}

export interface SwapArgs {
  inputMint: string;
  outputMint: string;
  amount: Amount;
  slippageBps?: number;
  network?: Network;
  idempotencyKey?: string;
}

export interface ExecuteArgs {
  instructions: SolanaInstructionInput[];
  addressLookupTableAccounts?: string[];
  network?: Network;
  idempotencyKey?: string;
}
