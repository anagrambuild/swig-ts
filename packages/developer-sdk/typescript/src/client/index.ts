import type { PreparedTransaction } from '../types/index.js';

export { createSecp256k1EvmSigningFn } from '../evm/index.js';
export { createSecp256r1PasskeySigningFn } from '../passkeys/index.js';
export type {
  CreateSecp256k1EvmSigningFnOptions,
  Eip1193Provider,
  PasskeySigningFn,
  PasskeySigningResult,
  PaymentPayloadV2,
  PaymentRequiredV2,
  PreparedTransaction,
  PrepareX402PaymentOptions,
  Secp256k1SigningFn,
  Secp256k1SigningResult,
  TransactionEncoding,
  WalletX402Client,
  X402PaymentSubmission,
  X402PreparationResult,
} from '../types/index.js';
export { createX402Payment } from '../x402/index.js';
export {
  signPreparedSwigTransaction,
  signPreparedSwigTransactions,
} from './swig-signing.js';
export type {
  Secp256k1SigningFns,
  Secp256r1SigningFns,
  SignPreparedSwigTransactionOptions,
} from './swig-signing.js';

export interface SignedPreparedTransaction {
  transaction: string;
  transactionEncoding?: PreparedTransaction['transactionEncoding'];
  network?: PreparedTransaction['network'];
}

export type PreparedTransactionSigningFn = (
  transaction: string,
  prepared: PreparedTransaction,
) => Promise<string>;

export interface SignPreparedOptions {
  signTransaction: PreparedTransactionSigningFn;
}

export interface PreparedTransactionSigner {
  signPreparedTransaction(
    prepared: PreparedTransaction,
  ): Promise<SignedPreparedTransaction>;
}

export async function signPreparedTransaction(
  prepared: PreparedTransaction,
  options: SignPreparedOptions,
): Promise<SignedPreparedTransaction> {
  return {
    transaction: await options.signTransaction(prepared.transaction, prepared),
    transactionEncoding: prepared.transactionEncoding,
    network: prepared.network,
  };
}

export async function signPreparedTransactionWithSigner(
  prepared: PreparedTransaction,
  signer: PreparedTransactionSigner,
): Promise<SignedPreparedTransaction> {
  return signer.signPreparedTransaction(prepared);
}
