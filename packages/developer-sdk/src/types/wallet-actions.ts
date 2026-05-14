import type { Amount, Network } from './common.js';
import type { SolanaInstructionInput } from './instruction.js';
import type { PreparedTransactionWire } from './transaction.js';
import type { WalletAddressInfo } from './wallet.js';

export interface CreateWalletArgs {
  policyId: string;
  feePayer: string;
  network?: Network;
  idempotencyKey?: string;
}

export interface CreateWalletResponse
  extends WalletAddressInfo, PreparedTransactionWire {
  network?: Network;
  label?: string;
  externalId?: string;
}

export interface BaseTransferArgs {
  feePayer: string;
  requesterPubkey?: string;
  amount: Amount;
  network?: Network;
  idempotencyKey?: string;
}

export interface TransferSolArgs extends BaseTransferArgs {
  destination: string;
  mint?: undefined;
}

export interface TransferTokenArgs extends BaseTransferArgs {
  mint: string;
  destination?: string;
  destinationOwner?: string;
  sourceTokenAccount?: string;
  destinationTokenAccount?: string;
  tokenProgram?: string;
  createDestinationTokenAccount?: boolean;
}

export type TransferArgs = TransferSolArgs | TransferTokenArgs;

export interface SwapArgs {
  feePayer: string;
  requesterPubkey?: string;
  inputMint: string;
  outputMint: string;
  amount: Amount;
  slippageBps?: number;
  destinationTokenAccount?: string;
  nativeDestinationAccount?: string;
  wrapAndUnwrapSol?: boolean;
  tipAmountLamports?: Amount;
  computeUnitPricePercentile?: string;
  maxAccounts?: number;
  mode?: string;
  blockhashSlotsToExpiry?: number;
  network?: Network;
  idempotencyKey?: string;
}

export interface ExecuteArgs {
  instructions: SolanaInstructionInput[];
  addressLookupTableAccounts?: string[];
  network?: Network;
  idempotencyKey?: string;
}
