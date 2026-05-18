import type { Amount, Network } from './common.js';
import type { SolanaInstructionInput } from './instruction.js';
import type { CreateWalletResult } from './transaction.js';

export type WalletAuthority =
  | { ed25519: { publicKey: string } }
  | { secp256k1: { publicKey: string } }
  | { secp256r1: { publicKey: string } };

export interface CreateWalletArgs {
  policyId?: string;
  feePayer: string;
  initialUser?: WalletAuthority;
  guardianPubkey?: string;
  network?: Network;
  idempotencyKey?: string;
}

export type CreateWalletResponse = CreateWalletResult;

export interface BaseTransferArgs {
  feePayer: string;
  requesterAuthority?: WalletAuthority;
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
  destinationOwner: string;
}

export type TransferArgs = TransferSolArgs | TransferTokenArgs;

export type PrepareOperation =
  | {
      type: 'transferSol';
      destination: string;
      amount: Amount;
    }
  | {
      type: 'transferToken';
      mint: string;
      destinationOwner: string;
      amount: Amount;
    };

export interface PrepareArgs {
  feePayer: string;
  requesterAuthority?: WalletAuthority;
  operations: PrepareOperation[];
  network?: Network;
  idempotencyKey?: string;
}

export interface SwapArgs {
  feePayer: string;
  requesterAuthority?: WalletAuthority;
  inputMint: string;
  outputMint: string;
  amount: Amount;
  slippageBps?: number;
  destinationAccount?: string;
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
