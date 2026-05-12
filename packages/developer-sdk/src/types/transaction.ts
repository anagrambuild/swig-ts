import type { JsonObject, Network } from './common.js';
import type { WalletAddressInfo } from './wallet.js';

export type TransactionEncoding = 'base64' | 'base58';

export interface PreparedTransaction {
  intentId: string;
  transaction: string;
  transactionEncoding?: TransactionEncoding;
  wallet?: WalletAddressInfo;
  expiresAt?: string;
}

export interface PreparedTransactionWire {
  intent_id?: string;
  intentId?: string;
  transaction?: string;
  unsigned_transaction?: string;
  unsignedTransaction?: string;
  transaction_encoding?: TransactionEncoding;
  transactionEncoding?: TransactionEncoding;
  wallet?: WalletAddressInfo;
  expires_at?: string;
  expiresAt?: string;
}

export interface SponsorSignedTransactionArgs {
  intentId?: string;
  transaction: string;
  transactionEncoding?: TransactionEncoding;
  network?: Network;
  metadata?: JsonObject;
  idempotencyKey?: string;
}

export interface SubmittedTransaction {
  intentId?: string;
  signature: string;
  status?: 'submitted' | 'confirmed';
}

export interface SubmittedTransactionWire {
  intent_id?: string;
  intentId?: string;
  signature?: string;
  status?: 'submitted' | 'confirmed';
}
