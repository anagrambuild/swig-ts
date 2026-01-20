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

// Export types
export type {
  PaymasterConfig,
  RetryOptions,
  SerializedTransaction,
} from './types.js';

export { PaymasterError } from './types.js';
