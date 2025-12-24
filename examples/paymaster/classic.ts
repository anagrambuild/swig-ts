/**
 * Paymaster Transaction Example (web3.js 1.x)
 *
 * Demonstrates gasless transactions where the paymaster covers fees.
 * Flow: Create tx → User signs → Paymaster signs & submits
 */

import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { createPaymasterClient } from '@swig-wallet/paymaster-classic';

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

// Initialize paymaster client with retry options for handling transient failures
const paymaster = createPaymasterClient({
  apiKey: PAYMASTER_API_KEY,
  paymasterPubkey: PAYMASTER_PUBKEY,
  baseUrl: PAYMASTER_BASE_URL,
  network: NETWORK,
  retryOptions: {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  },
});

// Generate user keypair (in production, this would be the user's wallet)
const userRootKeypair = Keypair.generate();

// Memo program allows storing short messages on-chain
const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);

// Create memo instruction - both user and paymaster must sign
const memoInstruction = new TransactionInstruction({
  keys: [
    { pubkey: userRootKeypair.publicKey, isSigner: true, isWritable: false },
    {
      pubkey: new PublicKey(PAYMASTER_PUBKEY),
      isSigner: true,
      isWritable: false,
    },
  ],
  programId: MEMO_PROGRAM_ID,
  data: Buffer.from('Transaction fees covered!'),
});

// Create legacy transaction with paymaster as fee payer, user signs
const transaction = await paymaster.createLegacyTransaction(
  [memoInstruction],
  [userRootKeypair],
);

// Paymaster signs and submits to network in one call
const signature = await paymaster.signAndSend(transaction);

console.log(
  'sig:',
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
);
