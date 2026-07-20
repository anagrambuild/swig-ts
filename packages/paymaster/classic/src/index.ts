import { address } from '@solana/kit';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Signer,
  type TransactionSignature,
} from '@solana/web3.js';
import {
  getJitoTipAccount,
  PaymasterClient as PaymasterClientInternal,
  PaymasterError,
  resolveJitoTipLamports,
  serializedBundleHasJitoTip,
  type JitoBundleOptions,
  type PaymasterConfig,
  type PaymasterSubmitOptions,
  type SponsorBundleResult,
} from '@swig-wallet/paymaster-core';

export {
  type JitoBundleOptions,
  type PaymasterConfig,
  type PaymasterSubmitOptions,
  type SponsorBundleResult,
} from '@swig-wallet/paymaster-core';

/**
 * Creates a new PaymasterClient instance for use with @solana/web3.js 1.x.
 *
 * This is a convenience factory function that instantiates a PaymasterClient
 * configured for the classic Solana web3.js API (version 1.x).
 *
 * @param config - Configuration options including API credentials and retry settings
 * @returns A configured PaymasterClient instance
 *
 * @example
 * ```ts
 * import { createPaymasterClient } from '@swig-wallet/paymaster-classic';
 *
 * const paymaster = createPaymasterClient({
 *   apiKey: 'your-api-key',
 *   paymasterPubkey: 'YourPaymasterPublicKey...',
 *   baseUrl: 'https://paymaster-api.example.com',
 *   network: 'mainnet',
 *   retryOptions: {
 *     maxRetries: 5
 *   }
 * });
 * ```
 */
export function createPaymasterClient(config: PaymasterConfig) {
  return new PaymasterClient(config);
}

/**
 * Client for interacting with Swig Paymaster using @solana/web3.js 1.x.
 *
 * Provides methods for creating, signing, and submitting both legacy and
 * versioned transactions sponsored by the paymaster. This client is designed
 * for the classic @solana/web3.js API (version 1.x).
 *
 * Supports:
 * - Legacy transactions (without address lookup tables)
 * - Versioned transactions (v0 with address lookup tables)
 *
 * @example
 * ```ts
 * import { createPaymasterClient } from '@swig-wallet/paymaster-classic';
 *
 * const paymaster = createPaymasterClient({
 *   apiKey: 'your-api-key',
 *   paymasterPubkey: '...',
 *   baseUrl: 'https://...',
 *   network: 'mainnet'
 * });
 *
 * // Create and send a legacy transaction
 * const tx = await paymaster.createLegacyTransaction([instruction], [signer]);
 * const signature = await paymaster.signAndSend(tx);
 * ```
 */
export class PaymasterClient {
  #paymasterClientInternal: PaymasterClientInternal;
  #config: PaymasterConfig;

  constructor(config: PaymasterConfig) {
    this.#config = config;
    this.#paymasterClientInternal = new PaymasterClientInternal({
      ...config,
      paymasterPubkey: address(config.paymasterPubkey),
    });
  }

  private get rpcUrl() {
    return this.#config.customRpcUrl
      ? this.#config.customRpcUrl
      : this.#config.network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com';
  }

  private get connection() {
    return new Connection(this.rpcUrl);
  }

  /**
   * Signs a serialized transaction with the paymaster's signature.
   *
   * Low-level method that works with serialized transaction bytes. For most use cases,
   * prefer using {@link sign} which works with transaction objects.
   *
   * @param serializedTransaction - Serialized transaction bytes
   * @returns Signed serialized transaction
   *
   * @see {@link sign} for signing transaction objects
   */
  signSerializedTransaction = (serializedTransaction: Uint8Array) => {
    return this.#paymasterClientInternal.signSerializedTransaction(
      serializedTransaction,
    );
  };

  /**
   * Signs and sends a serialized transaction to the network.
   *
   * Low-level method that works with serialized transaction bytes. For most use cases,
   * prefer using {@link signAndSend} which works with transaction objects.
   *
   * @param serializedTransaction - Serialized transaction bytes
   * @returns Transaction signature from the network
   *
   * @see {@link signAndSend} for signing and sending transaction objects
   */
  signAndSendSerializedTransaction = (
    serializedTransaction: Uint8Array,
    options?: PaymasterSubmitOptions,
  ) => {
    return this.#paymasterClientInternal.signAndSendSerializedTransaction(
      serializedTransaction,
      options,
    );
  };

  /**
   * Signs and sends serialized transactions as a Jito bundle.
   *
   * If no transaction contains a Jito tip, the core client appends a separate
   * paymaster-only tip transaction when the bundle still has room.
   *
   * @param serializedTransactions - Serialized transaction bytes
   * @param options - Optional Jito bundle settings
   * @returns Jito bundle submission result
   */
  signAndSendBundleSerializedTransactions = (
    serializedTransactions: Uint8Array[],
    options?: JitoBundleOptions,
  ): Promise<SponsorBundleResult> => {
    return this.#paymasterClientInternal.signAndSendBundleSerializedTransactions(
      serializedTransactions,
      options,
    );
  };

  /**
   * Creates a legacy (non-versioned) Solana transaction with paymaster as fee payer.
   *
   * Constructs a traditional Solana transaction without address lookup tables.
   * The paymaster is set as the fee payer, and the transaction is partially
   * signed with the provided signers. Use this for simple transactions that
   * don't require address lookup tables.
   *
   * @param instructions - Array of transaction instructions to execute
   * @param signers - Optional array of signers to partially sign the transaction
   * @returns A partially signed legacy Transaction
   *
   * @see {@link createTransaction} for versioned transactions with lookup tables
   *
   * @example
   * ```ts
   * import { SystemProgram, Keypair } from '@solana/web3.js';
   *
   * const instruction = SystemProgram.transfer({
   *   fromPubkey: userKeypair.publicKey,
   *   toPubkey: recipient,
   *   lamports: 1000000
   * });
   *
   * const tx = await paymaster.createLegacyTransaction(
   *   [instruction],
   *   [userKeypair]
   * );
   * ```
   */
  createLegacyTransaction = async (
    instructions: TransactionInstruction[],
    signers: Signer[] = [],
  ) => {
    const transaction = new Transaction().add(...instructions);
    transaction.feePayer = new PublicKey(this.#config.paymasterPubkey);
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;
    if (signers.length > 0) transaction.partialSign(...signers);
    return transaction;
  };

  /**
   * Creates a versioned transaction (v0) with optional address lookup tables.
   *
   * Constructs a v0 transaction that can utilize address lookup tables for
   * more efficient on-chain data usage. The paymaster is set as the fee payer,
   * and the transaction is partially signed with the provided signers.
   *
   * @param instructions - Array of transaction instructions to execute
   * @param signers - Optional array of signers to partially sign the transaction
   * @param lookupTableAddresses - Optional array of address lookup table addresses
   * @returns A partially signed VersionedTransaction
   *
   * @see {@link createLegacyTransaction} for simple transactions without lookup tables
   *
   * @example
   * ```ts
   * // With address lookup table
   * const lookupTable = new PublicKey('...');
   * const tx = await paymaster.createTransaction(
   *   [instruction],
   *   [userKeypair],
   *   [lookupTable]
   * );
   *
   * // Without address lookup table
   * const simpleTx = await paymaster.createTransaction(
   *   [instruction],
   *   [userKeypair]
   * );
   * ```
   */
  createTransaction = async (
    instructions: TransactionInstruction[],
    signers: Signer[] = [],
    lookupTableAddresses: PublicKey[] = [],
  ) => {
    const lookupTableAccounts = (
      await Promise.all(
        lookupTableAddresses.map(async (lt) => {
          const alt = await this.connection.getAddressLookupTable(lt);
          return alt.value;
        }),
      )
    ).filter((alt) => alt !== null);

    const { blockhash } = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: new PublicKey(this.#config.paymasterPubkey),
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(lookupTableAccounts);

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign(signers);
    return transaction;
  };

  /**
   * Creates a Jito tip instruction funded by the paymaster.
   *
   * Use this when constructing a bundle manually before user signatures are
   * collected.
   *
   * @param options - Optional Jito bundle settings
   * @returns System transfer instruction to a Jito tip account
   */
  createJitoTipInstruction = (
    options?: JitoBundleOptions,
  ): TransactionInstruction => {
    return SystemProgram.transfer({
      fromPubkey: new PublicKey(this.#config.paymasterPubkey),
      toPubkey: new PublicKey(getJitoTipAccount()),
      lamports: resolveJitoTipLamports(options),
    });
  };

  /**
   * Adds a Jito tip instruction to the last legacy transaction in a bundle.
   *
   * Call this before collecting user signatures. The method will not mutate a
   * transaction that already has signatures, because changing the message would
   * invalidate them.
   *
   * @param transactions - Unsigned legacy transactions to prepare
   * @param options - Optional Jito bundle settings
   * @returns The same transactions, with the tip added when needed
   */
  prepareJitoBundleTransactions = <T extends Transaction>(
    transactions: T[],
    options?: JitoBundleOptions,
  ): T[] => {
    if (transactions.length === 0) {
      throw new PaymasterError('At least one transaction is required');
    }

    if (transactions.length > 5) {
      throw new PaymasterError('Jito bundles support at most 5 transactions');
    }

    const serializedTransactions = transactions.map((transaction) =>
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    );
    if (
      serializedBundleHasJitoTip(
        serializedTransactions,
        this.#config.paymasterPubkey,
      )
    ) {
      return transactions;
    }

    const lastTransaction = transactions[transactions.length - 1]!;
    if (lastTransaction.signatures.some(({ signature }) => signature)) {
      throw new PaymasterError(
        'prepareJitoBundleTransactions must be called before signing transactions',
      );
    }

    lastTransaction.add(this.createJitoTipInstruction(options));
    try {
      lastTransaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    } catch (error) {
      throw new PaymasterError(
        error instanceof Error
          ? `Unable to fit Jito tip instruction in the last transaction: ${error.message}`
          : 'Unable to fit Jito tip instruction in the last transaction',
      );
    }

    return transactions;
  };

  /**
   * Signs a transaction with the paymaster's signature.
   *
   * Takes a transaction (legacy or versioned) that has been signed by the
   * required user signers and adds the paymaster's signature. Returns the
   * signed transaction without submitting it to the network.
   *
   * @param transaction - Partially signed Transaction or VersionedTransaction
   * @returns Signed transaction of the same type as input
   *
   * @throws {PaymasterError} If the paymaster API request fails
   *
   * @see {@link signAndSend} to sign and submit in one operation
   *
   * @example
   * ```ts
   * const tx = await paymaster.createLegacyTransaction([instruction], [signer]);
   * const signedTx = await paymaster.sign(tx);
   * // Inspect or modify signedTx before sending
   * ```
   */
  sign = async <T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> => {
    const serializedTx =
      await this.#paymasterClientInternal.signSerializedTransaction(
        transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      );
    if (isVersionedTransaction(transaction)) {
      return VersionedTransaction.deserialize(serializedTx) as T;
    }
    return Transaction.from(serializedTx) as T;
  };

  /**
   * Signs a transaction with the paymaster and submits it to the Solana network.
   *
   * This is a convenience method that combines paymaster signing and network
   * submission in a single operation. Supports both legacy and versioned
   * transactions. The transaction must already be signed by all required
   * user signers before calling this method.
   *
   * @param transaction - User-signed Transaction or VersionedTransaction
   * @returns Transaction signature from the Solana network
   *
   * @throws {PaymasterError} If signing or submission fails
   *
   * @see {@link sign} to sign without sending
   *
   * @example
   * ```ts
   * const tx = await paymaster.createTransaction([instruction], [userKeypair]);
   * const signature = await paymaster.signAndSend(tx);
   * console.log(`View at: https://explorer.solana.com/tx/${signature}`);
   * ```
   */
  signAndSend = <T extends Transaction | VersionedTransaction>(
    transaction: T,
    options?: PaymasterSubmitOptions,
  ): Promise<TransactionSignature> => {
    return this.#paymasterClientInternal.signAndSendSerializedTransaction(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
      options,
    );
  };

  /**
   * Signs transactions with the paymaster and submits them as a Jito bundle.
   *
   * Provided transactions are submitted unchanged. If none contains a valid
   * Jito tip, the SDK appends a separate paymaster-only tip transaction when
   * the bundle still has room.
   *
   * @param transactions - User-signed transactions ready for paymaster signature
   * @param options - Optional Jito bundle settings
   * @returns Jito bundle submission result
   */
  signAndSendBundle = <T extends Transaction | VersionedTransaction>(
    transactions: T[],
    options?: JitoBundleOptions,
  ): Promise<SponsorBundleResult> => {
    return this.#paymasterClientInternal.signAndSendBundleSerializedTransactions(
      transactions.map((transaction) =>
        transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      ),
      options,
    );
  };
}

function isVersionedTransaction(
  tx: Transaction | VersionedTransaction,
): tx is VersionedTransaction {
  return 'version' in tx;
}
