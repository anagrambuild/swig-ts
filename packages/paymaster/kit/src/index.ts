import {
  address,
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  assertIsFullySignedTransaction,
  assertIsTransactionWithinSizeLimit,
  type CompilableTransactionMessage,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  type FullySignedTransaction,
  getTransactionCodec,
  type Instruction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Transaction,
  type TransactionMessageWithBlockhashLifetime,
  type TransactionSigner,
  type TransactionWithBlockhashLifetime,
  type TransactionWithinSizeLimit,
  type TransactionWithLifetime,
} from '@solana/kit';
import {
  createJitoTipInstruction as createCoreJitoTipInstruction,
  type JitoBundleOptions,
  PaymasterClient as PaymasterClientInternal,
  type PaymasterConfig,
  type PaymasterSubmitOptions,
  type SponsorBundleResult,
  transactionMessageHasJitoTip,
} from '@swig-wallet/paymaster-core';

export {
  type JitoBundleOptions,
  type PaymasterConfig,
  type PaymasterSubmitOptions,
  type SponsorBundleResult,
} from '@swig-wallet/paymaster-core';

/**
 * Creates a new PaymasterClient instance for use with @solana/kit (web3.js 2.0).
 *
 * This is a convenience factory function that instantiates a PaymasterClient
 * configured for the new Solana web3.js 2.0 API with improved type safety.
 *
 * @param config - Configuration options including API credentials and retry settings
 * @returns A configured PaymasterClient instance
 *
 * @example
 * ```ts
 * import { createPaymasterClient } from '@swig-wallet/paymaster-kit';
 * import { address } from '@solana/kit';
 *
 * const paymaster = createPaymasterClient({
 *   apiKey: 'your-api-key',
 *   paymasterPubkey: address('YourPaymasterPublicKey...'),
 *   baseUrl: 'https://paymaster-api.example.com',
 *   network: 'mainnet',
 *   retryOptions: {
 *     maxRetries: 5,
 *     retryDelay: 2000
 *   }
 * });
 * ```
 */
export function createPaymasterClient(config: PaymasterConfig) {
  return new PaymasterClient(config);
}

/**
 * Client for interacting with Swig Paymaster using @solana/kit (web3.js 2.0).
 *
 * Provides high-level methods for creating, signing, and submitting transactions
 * sponsored by the paymaster. This client is designed for the new @solana/kit
 * API and provides full TypeScript support with improved type safety.
 *
 * @example
 * ```ts
 * import { createPaymasterClient } from '@swig-wallet/paymaster-kit';
 * import { address } from '@solana/kit';
 *
 * const paymaster = createPaymasterClient({
 *   apiKey: 'your-api-key',
 *   paymasterPubkey: address('...'),
 *   baseUrl: 'https://...',
 *   network: 'mainnet'
 * });
 *
 * // Create and send a transaction
 * const tx = await paymaster.createTransaction([instruction], [signer]);
 * const signature = await paymaster.signAndSend(tx);
 * ```
 */
export class PaymasterClient {
  #paymasterClientInternal: PaymasterClientInternal;
  #config: PaymasterConfig;

  constructor(config: PaymasterConfig) {
    this.#config = config;
    this.#paymasterClientInternal = new PaymasterClientInternal(config);
  }

  private get rpcUrl() {
    return this.#config.customRpcUrl
      ? this.#config.customRpcUrl
      : this.#config.network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com';
  }

  private get rpc() {
    return createSolanaRpc(this.rpcUrl);
  }

  private get paymasterPublicKey() {
    return address(this.#config.paymasterPubkey);
  }

  /**
   * Creates a new transaction with the paymaster set as the fee payer.
   *
   * Constructs a transaction message with the latest blockhash, adds the provided
   * instructions, and partially signs it with the provided signers. The paymaster
   * is automatically set as the fee payer, allowing gasless transactions for users.
   *
   * @param instructions - Array of Solana instructions to include in the transaction
   * @param signers - Optional array of transaction signers (default: empty array)
   * @returns A partially signed transaction ready for paymaster signing
   *
   * @example
   * ```ts
   * import { getAddMemoInstruction } from '@solana-program/memo';
   *
   * const instruction = getAddMemoInstruction({
   *   memo: 'Hello, Solana!',
   *   signers: [userKeypair]
   * });
   *
   * const tx = await paymaster.createTransaction([instruction], [userKeypair]);
   * ```
   */
  createTransaction = async <
    Inst extends Instruction[],
    T extends Transaction & TransactionWithLifetime,
  >(
    instructions: Inst,
    signers: TransactionSigner[] = [],
  ): Promise<T> => {
    const { value: latestBlockhash } = await this.rpc
      .getLatestBlockhash()
      .send();
    const tx = await pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(this.paymasterPublicKey, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
      (tx) => addSignersToTransactionMessage(signers, tx),
      (tx) => partiallySignTransactionMessageWithSigners(tx),
    );

    return tx as T;
  };

  /**
   * Signs a serialized transaction with the paymaster's signature.
   *
   * Low-level method that works with serialized transaction bytes. For most use cases,
   * prefer using {@link sign} or {@link fullySign} which work with transaction objects.
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
   * Creates a Jito tip instruction funded by the paymaster.
   *
   * Use this when constructing a bundle manually before user signatures are
   * collected.
   *
   * @param options - Optional Jito bundle settings
   * @returns System transfer instruction to a Jito tip account
   */
  createJitoTipInstruction = (options?: JitoBundleOptions): Instruction => {
    return createCoreJitoTipInstruction({
      paymasterPubkey: this.#config.paymasterPubkey,
      tipLamports: options?.tipLamports,
    });
  };

  /**
   * Adds a Jito tip instruction to the last transaction message in a bundle.
   *
   * Call this before collecting user signatures. If a valid Jito tip is already
   * present, the messages are returned unchanged.
   *
   * @param transactionMessages - Transaction messages to prepare
   * @param options - Optional Jito bundle settings
   * @returns Transaction messages with the tip added when needed
   */
  prepareJitoBundleTransactionMessages = <
    M extends CompilableTransactionMessage &
      TransactionMessageWithBlockhashLifetime,
  >(
    transactionMessages: M[],
    options?: JitoBundleOptions,
  ): M[] => {
    if (transactionMessages.length === 0) {
      throw new Error('At least one transaction message is required');
    }

    if (transactionMessages.length > 5) {
      throw new Error('Jito bundles support at most 5 transactions');
    }

    if (
      transactionMessages.some((transactionMessage) =>
        transactionMessageHasJitoTip(
          transactionMessage,
          this.#config.paymasterPubkey,
        ),
      )
    ) {
      return transactionMessages;
    }

    const lastIndex = transactionMessages.length - 1;
    const preparedMessages = transactionMessages.map(
      (transactionMessage, index) =>
        index === lastIndex
          ? (appendTransactionMessageInstructions(
              [this.createJitoTipInstruction(options)],
              transactionMessage,
            ) as unknown as M)
          : transactionMessage,
    );
    const transaction = compileTransaction(preparedMessages[lastIndex]!);
    assertIsTransactionWithinSizeLimit(transaction);

    return preparedMessages;
  };

  /**
   * Signs a transaction message and compiles it into a transaction.
   *
   * Takes a compilable transaction message, compiles it, and signs it with the paymaster.
   * Ensures the resulting transaction is within size limits.
   *
   * @param txMessage - Compilable transaction message with blockhash lifetime
   * @returns Signed transaction within size limits
   *
   * @example
   * ```ts
   * const txMessage = pipe(
   *   createTransactionMessage({ version: 0 }),
   *   (tx) => setTransactionMessageFeePayer(paymaster.paymasterPublicKey, tx),
   *   (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
   *   (tx) => appendTransactionMessageInstructions([instruction], tx)
   * );
   *
   * const signedTx = await paymaster.signTransactionMessage(txMessage);
   * ```
   */
  signTransactionMessage = async <
    M extends CompilableTransactionMessage &
      TransactionMessageWithBlockhashLifetime,
    T extends Transaction &
      TransactionWithBlockhashLifetime &
      TransactionWithinSizeLimit,
  >(
    txMessage: M,
  ): Promise<T> => {
    const tx = compileTransaction(txMessage);
    assertIsTransactionWithinSizeLimit(tx);
    return (await this.sign({
      ...tx,
      lifetimeConstraint: txMessage.lifetimeConstraint,
    })) as T;
  };

  /**
   * Signs a partially signed transaction with the paymaster's signature.
   *
   * Takes a transaction that has been signed by the required user signers and
   * adds the paymaster's signature. Returns the transaction without submitting
   * it to the network, allowing for inspection or additional processing.
   *
   * @param partiallySignedTransaction - Transaction signed by user(s) but not paymaster
   * @returns Signed transaction with paymaster signature added
   *
   * @throws {PaymasterError} If the paymaster API request fails
   *
   * @see {@link fullySign} for transactions requiring full signature validation
   * @see {@link signAndSend} to sign and submit in one operation
   *
   * @example
   * ```ts
   * const tx = await paymaster.createTransaction([instruction], [userSigner]);
   * const signedTx = await paymaster.sign(tx);
   * // Inspect signedTx before sending
   * ```
   */
  sign = async <T extends Transaction & TransactionWithLifetime>(
    partiallySignedTransaction: T,
  ): Promise<T & TransactionWithinSizeLimit> => {
    const serializedTx = new Uint8Array(
      getTransactionCodec().encode(partiallySignedTransaction),
    );
    const serializedTransaction =
      await this.signSerializedTransaction(serializedTx);
    const transaction = getTransactionCodec().decode(serializedTransaction);
    assertIsTransactionWithinSizeLimit(transaction);
    return {
      ...transaction,
      lifetimeConstraint: partiallySignedTransaction.lifetimeConstraint,
    } as T & TransactionWithinSizeLimit;
  };

  /**
   * Fully signs a transaction and validates all required signatures are present.
   *
   * Similar to {@link sign}, but asserts that the resulting transaction has all
   * required signatures and is ready for submission. Use this when you need
   * guarantees that the transaction is fully signed before proceeding.
   *
   * @param partiallySignedTransaction - Transaction signed by user(s) but not paymaster
   * @returns Fully signed transaction with all required signatures
   *
   * @throws {Error} If the transaction is missing required signatures
   * @throws {PaymasterError} If the paymaster API request fails
   *
   * @example
   * ```ts
   * const tx = await paymaster.createTransaction([instruction], [userSigner]);
   * const fullySignedTx = await paymaster.fullySign(tx);
   * // fullySignedTx is guaranteed to have all signatures
   * ```
   */
  fullySign = async <T extends Transaction & TransactionWithLifetime>(
    partiallySignedTransaction: T,
  ): Promise<
    FullySignedTransaction &
      TransactionWithBlockhashLifetime &
      Transaction &
      TransactionWithinSizeLimit
  > => {
    const serializedTx = new Uint8Array(
      getTransactionCodec().encode(partiallySignedTransaction),
    );
    const serializedTransaction =
      await this.signSerializedTransaction(serializedTx);
    const transaction = getTransactionCodec().decode(serializedTransaction);
    assertIsFullySignedTransaction(transaction);
    assertIsTransactionWithinSizeLimit(transaction);
    assertIsTransactionWithBlockhashLifetime(partiallySignedTransaction);
    return {
      ...transaction,
      lifetimeConstraint: partiallySignedTransaction.lifetimeConstraint,
    };
  };

  /**
   * Signs a transaction with the paymaster and submits it to the Solana network.
   *
   * This is a convenience method that combines paymaster signing and network
   * submission in a single operation. The transaction must already be signed
   * by all required user signers before calling this method.
   *
   * @param partiallySignedTransaction - User-signed transaction ready for paymaster signature
   * @returns Transaction signature from the Solana network
   *
   * @throws {PaymasterError} If signing or submission fails
   *
   * @see {@link sign} to sign without sending
   * @see {@link fullySign} to sign with full signature validation
   *
   * @example
   * ```ts
   * const tx = await paymaster.createTransaction([instruction], [userSigner]);
   * const signature = await paymaster.signAndSend(tx);
   * console.log(`Transaction confirmed: ${signature}`);
   * ```
   */
  signAndSend = async <T extends Transaction & TransactionWithLifetime>(
    partiallySignedTransaction: T & TransactionWithinSizeLimit,
    options?: PaymasterSubmitOptions,
  ): Promise<string> => {
    const serializedTx = new Uint8Array(
      getTransactionCodec().encode(partiallySignedTransaction),
    );
    return this.#paymasterClientInternal.signAndSendSerializedTransaction(
      serializedTx,
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
   * @param partiallySignedTransactions - User-signed transactions ready for paymaster signature
   * @param options - Optional Jito bundle settings
   * @returns Jito bundle submission result
   */
  signAndSendBundle = async <T extends Transaction & TransactionWithLifetime>(
    partiallySignedTransactions: Array<T & TransactionWithinSizeLimit>,
    options?: JitoBundleOptions,
  ): Promise<SponsorBundleResult> => {
    const serializedTransactions = partiallySignedTransactions.map(
      (transaction) =>
        new Uint8Array(getTransactionCodec().encode(transaction)),
    );
    return this.#paymasterClientInternal.signAndSendBundleSerializedTransactions(
      serializedTransactions,
      options,
    );
  };
}

function assertIsTransactionWithBlockhashLifetime(
  transaction: TransactionWithLifetime,
): asserts transaction is TransactionWithBlockhashLifetime {
  if (
    !(
      'lastValidBlockHeight' in transaction.lifetimeConstraint &&
      'blockhash' in transaction.lifetimeConstraint
    )
  ) {
    throw new Error('BlockhashLifetime not present in transaction');
  }
}
