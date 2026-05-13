import type { JsonObject, Network } from './common.js';
import type { WalletAddressInfo } from './wallet.js';

export type TransactionEncoding = 'base64';
export type ProtoTransactionEncoding =
  | 'TRANSACTION_ENCODING_UNSPECIFIED'
  | 'TRANSACTION_ENCODING_BASE64';
export type TransactionEncodingWire =
  | TransactionEncoding
  | ProtoTransactionEncoding
  | number;

export type ProtoNetwork =
  | 'NETWORK_UNSPECIFIED'
  | 'NETWORK_DEVNET'
  | 'NETWORK_MAINNET';
export type NetworkWire = Network | ProtoNetwork | number;

export interface PreparedTransaction {
  intentId: string;
  transaction: string;
  transactionEncoding?: TransactionEncoding;
  wallet?: WalletAddressInfo;
  expiresAt?: string;
  network?: Network;
  recentBlockhash?: string;
}

export interface PreparedTransactionWire {
  intent_id?: string;
  intentId?: string;
  transaction?: string;
  unsigned_transaction?: string;
  unsignedTransaction?: string;
  transaction_encoding?: TransactionEncodingWire;
  transactionEncoding?: TransactionEncodingWire;
  wallet?: WalletAddressInfo;
  expires_at?: string;
  expiresAt?: string;
  network?: NetworkWire;
  recent_blockhash?: string;
  recentBlockhash?: string;
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
