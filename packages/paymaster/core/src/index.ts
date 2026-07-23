/**
 * Swig Paymaster SDK
 *
 * A TypeScript SDK for interacting with the Swig Paymaster service.
 * Enables Solana transaction sponsorship with automatic fee payment.
 *
 * @packageDocumentation
 */

// Export the main client
export { PaymasterClient } from './client.js';

// Export transaction utilities
export { isPaymasterFeePayer } from './helpers.js';
export {
  createJitoTipInstruction,
  getJitoTipAccount,
  isJitoTipAccount,
  isValidJitoTipTotal,
  resolveJitoTipLamports,
  serializedBundleHasSufficientJitoTip,
  serializedTransactionJitoTipLamports,
  transactionMessageJitoTipLamports,
} from './jito.js';

// Export types
export type {
  JitoBundleOptions,
  PaymasterConfig,
  PaymasterSubmitOptions,
  RetryOptions,
  SerializedTransaction,
  SponsorBundleResult,
} from './types.js';

export { PaymasterError } from './types.js';
