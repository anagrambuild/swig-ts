import type { PreparedTransaction } from '../types/index.js';

export { createSecp256r1PasskeySigningFn } from '../passkeys/index.js';
export type {
  PasskeySigningFn,
  PasskeySigningResult,
  PreparedTransaction,
  TransactionEncoding,
} from '../types/index.js';

export interface SignedPreparedTransaction {
  intentId: string;
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

export async function signPreparedTransaction(
  prepared: PreparedTransaction,
  options: SignPreparedOptions,
): Promise<SignedPreparedTransaction> {
  return {
    intentId: prepared.intentId,
    transaction: await options.signTransaction(prepared.transaction, prepared),
    transactionEncoding: prepared.transactionEncoding,
    network: prepared.network,
  };
}
