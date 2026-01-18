/**
 * Paymaster Transaction Example (web3.js 2.0)
 *
 * Demonstrates gasless transactions where the paymaster covers fees.
 * Flow: Create tx → User signs → Paymaster signs → User submit to network
 */

import { getAddMemoInstruction } from '@solana-program/memo';
import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  partiallySignTransaction,
  sendAndConfirmTransactionFactory,
} from '@solana/kit';
import { createPaymasterClient } from '@swig-wallet/paymaster-kit';

// ============================================================================
// Configuration
// ============================================================================

const PAYMASTER_API_KEY = 'dev-api-key-123';
const PAYMASTER_PUBKEY = 'A1dBRAaYUHyUzyQLGYzHrQzpYy9xTVXCaMnHx4RuEGY5';
const PAYMASTER_BASE_URL = 'http://localhost:3000';
const NETWORK: 'mainnet' | 'devnet' = 'devnet';

// ============================================================================
// Main Example
// ============================================================================

console.log('🚀 Paymaster Example');
console.log('═'.repeat(70));
console.log();

console.log('📋 Configuration:');
console.log(`   Network:    ${NETWORK}`);
console.log(`   API URL:    ${PAYMASTER_BASE_URL}`);
console.log(`   Paymaster:  ${PAYMASTER_PUBKEY}`);
console.log();

// Initialize paymaster client with API credentials
const paymaster = createPaymasterClient({
  apiKey: PAYMASTER_API_KEY,
  paymasterPubkey: address(PAYMASTER_PUBKEY),
  baseUrl: PAYMASTER_BASE_URL,
  network: NETWORK,
});

// Set up RPC connection for transaction confirmation
const baseUrl =
  NETWORK === 'devnet'
    ? 'api.devnet.solana.com'
    : 'api.mainnet-beta.solana.com';

const connection = {
  rpc: createSolanaRpc(`https://${baseUrl}`),
  rpcSubscriptions: createSolanaRpcSubscriptions(`wss://${baseUrl}`),
};

// Generate user keypair (in production, this would be the user's wallet)
const userRootKeypair = await generateKeyPairSigner();

// Create a memo instruction - user proves authorization by signing
const instruction = getAddMemoInstruction({
  memo: 'Transaction fees covered!',
  signers: [userRootKeypair],
});

// Create transaction with paymaster as fee payer
const unsignedTransaction = await paymaster.createTransaction([instruction]);

// User signs first to authorize the transaction
const partiallySignedTransaction = await partiallySignTransaction(
  [userRootKeypair.keyPair],
  unsignedTransaction,
);

// Paymaster signs and validates (covers fees)
const signedTransaction = await paymaster.fullySign(partiallySignedTransaction);

// Submit to network and wait for confirmation
await sendAndConfirmTransactionFactory(connection)(signedTransaction, {
  commitment: 'confirmed',
});

// Extract and display the transaction signature
const signature = getSignatureFromTransaction(signedTransaction).toString();

console.log(
  'sig:',
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
);
