import {
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getTransactionEncoder,
  isFullySignedTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Blockhash,
  type KeyPairSigner,
  type Transaction,
} from '@solana/kit';
import type { KitInstruction } from '@swig-wallet/lib';
import {
  _internalBatchSignTransactions as libBatchSignTransactions,
  SolInstruction,
  type BatchSignOptions,
  type SolPublicKeyData,
  type Swig,
  type SwigOptions,
} from '@swig-wallet/lib';

/**
 * Configuration for a single transaction in a batch (Kit)
 */
export type BatchTransactionConfig = {
  swig: Swig;
  roleId: number;
  innerInstructions: KitInstruction[];
  feePayer: KeyPairSigner;
  recentBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>;
  signers?: KeyPairSigner[];
  withSubAccount?: boolean;
  options?: SwigOptions;
};

/**
 * Result of batch signing a single transaction (Kit)
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
 * Batch sign multiple Swig transactions (Kit)
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
  const normalizedConfigs = Array.isArray(configs)
    ? configs
    : configs.transactions.map((transaction) => ({
        ...transaction,
        swig: configs.swig,
        roleId: configs.roleId,
      }));

  // Convert Kit types to lib types
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

  const libConfigs: LibBatchConfig[] = normalizedConfigs.map((config) => ({
    swig: config.swig,
    roleId: config.roleId,
    innerInstructions: config.innerInstructions.map((ix) =>
      SolInstruction.from(ix),
    ),
    feePayer: config.feePayer.address,
    recentBlockhash: config.recentBlockhash,
    signers: config.signers?.map((signer) => ({
      publicKey: signer.address,
    })),
    withSubAccount: config.withSubAccount,
    options: config.options,
  }));

  // Call lib batch signing
  const libResults = await libBatchSignTransactions(libConfigs, options);

  // Convert lib results to Kit Transaction objects
  const results: SignedBatchTransaction[] = [];

  for (let i = 0; i < libResults.length; i++) {
    const libResult = libResults[i];
    const originalConfig = normalizedConfigs[i];
    const instructions = libResult.instructions.map((ix: SolInstruction) =>
      ix.toKitInstruction(),
    );

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(originalConfig.feePayer, tx),
      (tx) =>
        setTransactionMessageLifetimeUsingBlockhash(
          originalConfig.recentBlockhash,
          tx,
        ),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
      (tx) => addSignersToTransactionMessage(originalConfig.signers ?? [], tx),
    );

    const transaction =
      options.signMode === 'full'
        ? await signTransactionMessageWithSigners(transactionMessage)
        : await partiallySignTransactionMessageWithSigners(transactionMessage);

    // Encode in different formats
    const buffer = new Uint8Array(getTransactionEncoder().encode(transaction));
    const base64 = getBase64EncodedWireTransaction(transaction);
    const base58 = getBase58Decoder().decode(buffer);

    results.push({
      transaction,
      encoded: {
        base64,
        base58,
        buffer,
      },
      isFullySigned: isFullySignedTransaction(transaction),
    });
  }

  return results;
}
