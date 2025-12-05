import type { Blockhash } from '@solana/kit';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Signer,
} from '@solana/web3.js';
import {
  _internalBatchSignTransactions as libBatchSignTransactions,
  SolInstruction,
  type BatchSignOptions,
  type SolPublicKeyData,
  type Swig,
  type SwigOptions,
} from '@swig-wallet/lib';

/**
 * Configuration for a single transaction in a batch (Classic)
 */
export type BatchTransactionConfig = {
  swig: Swig;
  roleId: number;
  innerInstructions: TransactionInstruction[];
  feePayer: PublicKey;
  recentBlockhash: string;
  signers?: Signer[];
  withSubAccount?: boolean;
  options?: SwigOptions;
};

/**
 * Result of batch signing a single transaction (Classic)
 */
export type SignedBatchTransaction = {
  transaction: Transaction;
  encoded: {
    base64: string;
    base58: string;
    buffer: Uint8Array;
  };
  isFullySigned: boolean;
};

/**
 * Helper to encode transaction to base58
 * Uses bs58 library (available via web3.js dependency)
 */
function encodeBase58(buffer: Uint8Array): string {
  // Try to import bs58 - it should be available since web3.js depends on it
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bs58 = require('bs58');
    return bs58.encode(buffer);
  } catch {
    // If bs58 is not available, throw a helpful error
    throw new Error(
      'bs58 library is required for base58 encoding. Please ensure @solana/web3.js (which includes bs58) is installed.',
    );
  }
}

/**
 * Batch sign multiple Swig transactions (Classic)
 *
 * @param configs Either an array of full configs, or an object with shared swig/roleId and array of transaction configs
 * @param options Batch signing options
 * @returns Array of signed transaction objects with encoding
 */
export async function batchSignTransactions(
  configs:
    | BatchTransactionConfig[]
    | {
        swig: Swig;
        roleId: number;
        transactions: Array<Omit<BatchTransactionConfig, 'swig' | 'roleId'>>;
      },
  options: BatchSignOptions,
): Promise<SignedBatchTransaction[]> {
  // Convert Classic types to lib types
  // Lib batch config type (matching lib's BatchTransactionConfig structure)
  type LibBatchConfig = {
    swig: Swig;
    roleId: number;
    innerInstructions: SolInstruction[];
    feePayer: SolPublicKeyData;
    recentBlockhash:
      | Blockhash
      | string
      | Readonly<{ blockhash: Blockhash; lastValidBlockHeight: bigint }>;
    signers?: Array<{ publicKey: SolPublicKeyData }>;
    withSubAccount?: boolean;
    options?: SwigOptions;
  };
  let libConfigs: LibBatchConfig[];
  if (Array.isArray(configs)) {
    libConfigs = configs.map((config) => ({
      swig: config.swig,
      roleId: config.roleId,
      innerInstructions: config.innerInstructions.map((ix) =>
        SolInstruction.from(ix),
      ),
      feePayer: config.feePayer,
      recentBlockhash: config.recentBlockhash,
      signers: config.signers?.map((signer) => ({
        publicKey: signer.publicKey,
      })),
      withSubAccount: config.withSubAccount,
      options: config.options,
    }));
  } else {
    libConfigs = configs.transactions.map((tx) => ({
      swig: configs.swig,
      roleId: configs.roleId,
      innerInstructions: tx.innerInstructions.map((ix) =>
        SolInstruction.from(ix),
      ),
      feePayer: tx.feePayer,
      recentBlockhash: tx.recentBlockhash,
      signers: tx.signers?.map((signer) => ({
        publicKey: signer.publicKey,
      })),
      withSubAccount: tx.withSubAccount,
      options: tx.options,
    }));
  }

  // Call lib batch signing
  const libResults = await libBatchSignTransactions(libConfigs, options);

  // Convert lib results to Classic Transaction objects
  const results: SignedBatchTransaction[] = [];

  for (let i = 0; i < libResults.length; i++) {
    const libResult = libResults[i];
    const originalConfig = Array.isArray(configs)
      ? configs[i]
      : {
          ...configs.transactions[i],
          swig: configs.swig,
          roleId: configs.roleId,
        };

    // Convert instructions to TransactionInstruction[]
    const web3Instructions = libResult.instructions.map(
      (ix: SolInstruction) => {
        const web3Ix = ix.toWeb3Instruction();
        return new TransactionInstruction({
          programId: new PublicKey(web3Ix.programId.toBytes()),
          keys: web3Ix.keys.map((key) => ({
            pubkey: new PublicKey(key.pubkey.toBytes()),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          data: Buffer.from(web3Ix.data),
        });
      },
    );

    // Build Transaction
    const transaction = new Transaction();
    transaction.add(...web3Instructions);
    transaction.feePayer = originalConfig.feePayer;
    transaction.recentBlockhash = libResult.recentBlockhash as string;

    // Sign transaction based on mode
    if (options.signMode === 'full' && originalConfig.signers) {
      // Sign with all signers for full signing
      transaction.sign(...originalConfig.signers);
    } else if (options.signMode === 'partial' && originalConfig.signers) {
      // For partial signing, use partialSign() to allow transaction to be sent
      // even if not all required signatures are present
      // Swig signature is already in the instructions
      transaction.partialSign(...originalConfig.signers);
    }

    // Serialize transaction
    const serialized = transaction.serialize({
      requireAllSignatures: false, // Allow partial signatures
      verifySignatures: false,
    });

    // Encode in different formats
    const base64 = Buffer.from(serialized).toString('base64');
    const base58 = encodeBase58(serialized);
    const buffer = new Uint8Array(serialized);

    results.push({
      transaction,
      encoded: {
        base64,
        base58,
        buffer,
      },
      isFullySigned: libResult.isFullySigned,
    });
  }

  return results;
}
