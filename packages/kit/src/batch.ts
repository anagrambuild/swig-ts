import {
  signTransactionMessageWithSigners,
  type Blockhash,
  type KeyPairSigner,
} from '@solana/kit';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
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
  transaction: Awaited<ReturnType<typeof signTransactionMessageWithSigners>>;
  encoded: {
    base64: string;
    base58: string;
    buffer: Uint8Array;
  };
  isFullySigned: boolean;
};

/**
 * Helper to encode transaction to base58
 * Uses bs58 library (should be available via @solana/kit or web3.js)
 */
function encodeBase58(buffer: Uint8Array): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bs58 = require('bs58');
    return bs58.encode(buffer);
  } catch {
    throw new Error(
      'bs58 library is required for base58 encoding. Please ensure bs58 is installed.',
    );
  }
}

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
  let libConfigs: LibBatchConfig[];
  if (Array.isArray(configs)) {
    libConfigs = configs.map((config) => ({
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
  } else {
    libConfigs = configs.transactions.map((tx) => ({
      swig: configs.swig,
      roleId: configs.roleId,
      innerInstructions: tx.innerInstructions.map((ix) =>
        SolInstruction.from(ix),
      ),
      feePayer: tx.feePayer.address,
      recentBlockhash: tx.recentBlockhash,
      signers: tx.signers?.map((signer) => ({
        publicKey: signer.address,
      })),
      withSubAccount: tx.withSubAccount,
      options: tx.options,
    }));
  }

  // Call lib batch signing
  const libResults = await libBatchSignTransactions(libConfigs, options);

  // Convert lib results to Kit TransactionMessage objects
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

    // Convert instructions to web3.js TransactionInstruction[] for signing
    // This allows us to use web3.js signing methods which support partial signing
    // Kit's signTransactionMessageWithSigners requires all signatures, but Swig
    // signatures are embedded in instruction data, so we use web3.js Transaction instead
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

    // Build web3.js Transaction for signing (supports partial signing)
    const web3Transaction = new Transaction();
    web3Transaction.add(...web3Instructions);
    web3Transaction.feePayer = new PublicKey(originalConfig.feePayer.address);
    const blockhashStr =
      typeof libResult.recentBlockhash === 'string'
        ? libResult.recentBlockhash
        : libResult.recentBlockhash.blockhash;
    web3Transaction.recentBlockhash = blockhashStr as string;

    // Sign transaction based on mode
    if (originalConfig.signers && originalConfig.signers.length > 0) {
      // Sign the transaction message with provided signers
      const message = web3Transaction.serializeMessage();
      await Promise.all(
        originalConfig.signers.map(async (signer) => {
          // Check if signer has signMessage (custom) or signMessages (standard Kit)
          let signature: Uint8Array;
          if (
            'signMessage' in signer &&
            typeof signer.signMessage === 'function'
          ) {
            // Custom signer with signMessage method (like in examples)
            signature = await signer.signMessage(new Uint8Array(message));
          } else if (
            'signMessages' in signer &&
            typeof signer.signMessages === 'function'
          ) {
            // Standard Kit KeyPairSigner with signMessages method
            const results = await signer.signMessages([
              {
                content: new Uint8Array(message),
                signatures: {},
              },
            ]);
            // results is an array of signature maps, get the first one
            const signatureMap = results[0];
            signature = signatureMap[signer.address];
          } else {
            throw new Error(
              'Signer does not have signMessage or signMessages method',
            );
          }

          if (signature) {
            web3Transaction.addSignature(
              new PublicKey(signer.address),
              Buffer.from(signature),
            );
          }
        }),
      );
    }

    // Serialize the web3.js transaction
    const serialized = web3Transaction.serialize({
      requireAllSignatures: false, // Allow partial signatures (Swig sig is in instructions)
      verifySignatures: false,
    });

    // Create a compatible signed transaction object for Kit return type
    const signedTransaction = {
      serializedBytes: new Uint8Array(serialized),
      serialize: () => new Uint8Array(serialized),
    } as unknown as Awaited<
      ReturnType<typeof signTransactionMessageWithSigners>
    >;

    // Encode in different formats
    const base64 = Buffer.from(serialized).toString('base64');
    const base58 = encodeBase58(serialized);
    const buffer = new Uint8Array(serialized);

    results.push({
      transaction: signedTransaction,
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
