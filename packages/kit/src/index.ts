// Re-export everything from lib
export * from '@swig-wallet/lib';
export * from './accounts';
// Re-export batch module (overrides lib's batchSignTransactions and BatchTransactionConfig)
export {
  batchSignTransactions,
  type BatchTransactionConfig,
  type SignedBatchTransaction,
} from './batch';
export * from './consts';
export * from './instructions';
export * from './utils';
