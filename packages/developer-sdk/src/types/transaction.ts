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

export type PreparedTransactionKind =
  | 'create-swig-wallet'
  | 'add-authority'
  | 'configure-recovery';
export type ProtoPreparedTransactionKind =
  | 'PREPARED_TRANSACTION_KIND_UNSPECIFIED'
  | 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET'
  | 'PREPARED_TRANSACTION_KIND_ADD_AUTHORITY'
  | 'PREPARED_TRANSACTION_KIND_CONFIGURE_RECOVERY';
export type PreparedTransactionKindWire =
  | PreparedTransactionKind
  | ProtoPreparedTransactionKind
  | number;

export interface PreparedTransaction {
  transaction: string;
  transactionEncoding?: TransactionEncoding;
  wallet?: WalletAddressInfo;
  expiresAt?: string;
  network?: Network;
  recentBlockhash?: string;
  kind?: PreparedTransactionKind;
  signatureRequests: ClientSignatureRequest[];
}

export interface PreparedTransactionWire {
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
  kind?: PreparedTransactionKindWire;
  signature_requests?: ClientSignatureRequestWire[];
  signatureRequests?: ClientSignatureRequestWire[];
}

export interface ClientSignatureRequest {
  scheme: 'secp256r1' | 'secp256k1';
  signer: string;
  messageHash: string;
  slot: number;
  counter: number;
}

export interface ClientSignatureRequestWire {
  scheme?:
    | 'AUTHORITY_SIGNATURE_SCHEME_SECP256R1'
    | 'AUTHORITY_SIGNATURE_SCHEME_SECP256K1'
    | number;
  signer?: string;
  message_hash?: string;
  messageHash?: string;
  slot?: number | string;
  counter?: number;
}

export interface CreateWalletResponseWire extends PreparedTransactionWire {
  wallet?: WalletAddressInfo;
  transactions?: PreparedTransactionWire[];
}

export interface CreateWalletResult {
  wallet: WalletAddressInfo & { network?: Network };
  transactions: PreparedTransaction[];
  clientAuthorityTransactions: PreparedTransaction[];
  operatorSignedTransactions: PreparedTransaction[];
  feePayerOnlyTransactions: PreparedTransaction[];
  creationTransaction?: PreparedTransaction;
  addAuthorityTransaction?: PreparedTransaction;
  configureRecoveryTransaction?: PreparedTransaction;
  network?: Network;
}

export interface SponsorSignedTransactionArgs {
  transaction: string;
  transactionEncoding?: TransactionEncoding;
  network?: Network;
  metadata?: JsonObject;
  idempotencyKey?: string;
}

export interface SubmittedTransaction {
  signature: string;
  status?: 'submitted' | 'confirmed';
}

export interface SubmittedTransactionWire {
  signature?: string;
  status?: 'submitted' | 'confirmed';
}
