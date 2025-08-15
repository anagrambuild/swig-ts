// Utility functions for Solana Explorer integration with localhost RPC

const LOCALHOST_RPC = 'http://localhost:8899';

/**
 * Generate Solana Explorer URL for an account with localhost RPC
 */
export function getAccountExplorerUrl(address: string): string {
  const rpcParam = encodeURIComponent(LOCALHOST_RPC);
  return `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${rpcParam}`;
}

/**
 * Generate Solana Explorer URL for a transaction with localhost RPC
 */
export function getTransactionExplorerUrl(signature: string): string {
  const rpcParam = encodeURIComponent(LOCALHOST_RPC);
  return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${rpcParam}`;
}

/**
 * Generate Solana Explorer URL for a block with localhost RPC
 */
export function getBlockExplorerUrl(slot: number): string {
  const rpcParam = encodeURIComponent(LOCALHOST_RPC);
  return `https://explorer.solana.com/block/${slot}?cluster=custom&customUrl=${rpcParam}`;
}

/**
 * Format address for display (show first 4 and last 4 characters)
 */
export function formatAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Format transaction signature for display
 */
export function formatSignature(signature: string): string {
  if (signature.length <= 16) return signature;
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}
