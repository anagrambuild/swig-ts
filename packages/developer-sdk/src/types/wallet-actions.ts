import type { Amount, Network } from './common.js';
import type { SolanaInstructionInput } from './instruction.js';
import type {
  AddAuthorityChallenge,
  PreparedTransaction,
  PreparedTransactionWire,
} from './transaction.js';
import type { WalletAddressInfo } from './wallet.js';

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

export interface CreateWalletResponse
  extends WalletAddressInfo, PreparedTransactionWire {
  network?: Network;
  label?: string;
  externalId?: string;
  transactions?: PreparedTransaction[];
  creationTransaction?: PreparedTransaction;
  addAuthorityChallenge?: AddAuthorityChallenge;
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
  destinationOwner: string;
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
