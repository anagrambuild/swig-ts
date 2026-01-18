import {
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from '@solana/kit';
import { type SerializedTransaction } from './types.js';

/**
 * Checks if a serialized transaction has the paymaster set as the fee payer.
 *
 * Deserializes the transaction bytes and verifies that the fee payer address
 * matches the provided paymaster public key.
 *
 * @param serializedTx - Serialized transaction as raw bytes (Uint8Array)
 * @param paymasterPubkey - The public key of the paymaster account as a string
 * @returns True if the paymaster is the fee payer, false otherwise
 *
 * @example
 * ```ts
 * const isPaymaster = isPaymasterFeePayer(serializedTx, paymasterPubkey);
 * if (!isPaymaster) {
 *   throw new Error('Transaction not configured for paymaster');
 * }
 * ```
 */
export function isPaymasterFeePayer(
  serializedTx: SerializedTransaction,
  paymasterPubkey: string,
): boolean {
  // Decode the transaction from bytes
  const transaction = getTransactionDecoder().decode(serializedTx);

  const compiledTransactionMessage =
    getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);

  // Decompile the transaction to get the transaction message
  const transactionMessage = decompileTransactionMessage(
    compiledTransactionMessage,
  );

  // Check if the fee payer matches the paymaster public key
  return transactionMessage.feePayer.address.toString() === paymasterPubkey;
}
