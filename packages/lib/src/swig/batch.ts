import type { Blockhash } from '@solana/kit';
import { SolInstruction, SolPublicKey, type SolPublicKeyData } from '../solana';
import { getSignInstructionContext, type Swig, type SwigOptions } from './index';

/**
 * Configuration for a single transaction in a batch
 */
export type BatchTransactionConfig = {
  swig: Swig;
  roleId: number;
  innerInstructions: SolInstruction[];
  feePayer: SolPublicKeyData;
  recentBlockhash: Blockhash | string | Readonly<{ blockhash: Blockhash; lastValidBlockHeight: bigint }>;
  signers?: Array<{ publicKey: SolPublicKeyData }>;
  withSubAccount?: boolean;
  options?: SwigOptions;
};

/**
 * Options for batch signing
 */
export type BatchSignOptions = {
  signMode: 'partial' | 'full';
  encoding?: 'base64' | 'base58' | 'buffer';
};

/**
 * Result of batch signing a single transaction
 */
export type SignedBatchTransactionResult = {
  instructions: SolInstruction[];
  feePayer: SolPublicKey;
  recentBlockhash: Blockhash | string | Readonly<{ blockhash: Blockhash; lastValidBlockHeight: bigint }>;
  isFullySigned: boolean;
  serialized?: Uint8Array;
  encoded?: {
    base64?: string;
    base58?: string;
    buffer?: Uint8Array;
  };
};

/**
 * Batch sign multiple Swig transactions
 *
 * @param configs Either an array of full configs, or an object with shared swig/roleId and array of transaction configs
 * @param options Batch signing options
 * @returns Array of signed transaction results
 */
export async function batchSignTransactions(
  configs:
    | BatchTransactionConfig[]
    | {
        swig: Swig;
        roleId: number;
        transactions: Array<
          Omit<BatchTransactionConfig, 'swig' | 'roleId'>
        >;
      },
  options: BatchSignOptions,
): Promise<SignedBatchTransactionResult[]> {
  // Normalize configs to array format
  let normalizedConfigs: BatchTransactionConfig[];
  if (Array.isArray(configs)) {
    normalizedConfigs = configs;
  } else {
    normalizedConfigs = configs.transactions.map((tx) => ({
      ...tx,
      swig: configs.swig,
      roleId: configs.roleId,
    }));
  }

  // Process each transaction
  const results: SignedBatchTransactionResult[] = [];

  for (const config of normalizedConfigs) {
    // Get Swig sign instruction context
    const signContext = await getSignInstructionContext(
      config.swig,
      config.roleId,
      config.innerInstructions,
      config.withSubAccount,
      config.options,
    );

    // Combine all instructions (pre + swig + post)
    const allInstructions = [
      ...signContext.preInstructions,
      signContext.swigInstruction,
      ...signContext.postInstructions,
    ];

    // Determine if fully signed
    const isFullySigned =
      options.signMode === 'full' &&
      config.signers !== undefined &&
      config.signers.length > 0;

    // For partial signing, we only have Swig signature
    // For full signing, we would need to sign with all signers (handled by wrappers)

    const result: SignedBatchTransactionResult = {
      instructions: allInstructions,
      feePayer: new SolPublicKey(config.feePayer),
      recentBlockhash: config.recentBlockhash,
      isFullySigned,
    };

    // Note: Actual transaction serialization and encoding will be handled by wrappers
    // since lib doesn't have web3.js Transaction dependency
    // The wrappers will use this data to build and encode the transactions

    results.push(result);
  }

  return results;
}

