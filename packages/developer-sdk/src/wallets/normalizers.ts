import type {
  Amount,
  ClientSignatureRequest,
  ClientSignatureRequestWire,
  CreateWalletResponseWire,
  CreateWalletResult,
  Network,
  NetworkWire,
  PreparedTransaction,
  PreparedTransactionKind,
  PreparedTransactionKindWire,
  PreparedTransactionWire,
  SolanaInstruction,
  SolanaInstructionInput,
  SubmittedTransaction,
  SubmittedTransactionWire,
  TransactionEncoding,
  TransactionEncodingWire,
} from '../types/index.js';

export function normalizePreparedTransaction(
  response: PreparedTransactionWire,
): PreparedTransaction {
  const transaction =
    response.transaction ??
    response.unsignedTransaction ??
    response.unsigned_transaction;
  if (!transaction) {
    throw new Error('Prepared transaction response is missing transaction');
  }

  return {
    wallet: response.wallet,
    transaction,
    transactionEncoding: normalizeTransactionEncoding(
      response.transactionEncoding ?? response.transaction_encoding,
    ),
    expiresAt: response.expiresAt ?? response.expires_at,
    network: normalizeNetwork(response.network),
    recentBlockhash: response.recentBlockhash ?? response.recent_blockhash,
    kind: normalizePreparedTransactionKind(response.kind),
    signatureRequests: normalizeSignatureRequests(
      response.signatureRequests ?? response.signature_requests,
    ),
  };
}

export function normalizeCreateWalletResponse(
  response: CreateWalletResponseWire,
): CreateWalletResult {
  const topLevelNetwork = normalizeNetwork(response.network);
  const transactions = Array.isArray(response.transactions)
    ? response.transactions.map((transaction) =>
        normalizePreparedTransaction({
          ...transaction,
          network: transaction.network ?? response.network,
        }),
      )
    : [normalizePreparedTransaction(response)];
  const creationTransaction =
    transactions.find(
      (transaction) => transaction.kind === 'create-swig-wallet',
    ) ?? transactions[0];
  const addAuthorityTransaction = transactions.find(
    (transaction) => transaction.kind === 'add-authority',
  );
  const configureRecoveryTransaction = transactions.find(
    (transaction) => transaction.kind === 'configure-recovery',
  );
  const wallet = response.wallet ?? creationTransaction?.wallet;

  if (!wallet) {
    throw new Error('Create wallet response is missing wallet');
  }

  return {
    wallet,
    transactions,
    clientAuthorityTransactions: transactions.filter(
      (transaction) => transaction.signatureRequests.length > 0,
    ),
    operatorSignedTransactions: transactions.filter(
      (transaction) => transaction.kind === 'configure-recovery',
    ),
    feePayerOnlyTransactions: transactions.filter(
      (transaction) =>
        transaction.kind !== 'add-authority' &&
        transaction.kind !== 'configure-recovery',
    ),
    creationTransaction,
    addAuthorityTransaction,
    configureRecoveryTransaction,
    network: topLevelNetwork ?? creationTransaction?.network,
  };
}

export function normalizeSubmittedTransaction(
  response: SubmittedTransactionWire,
): SubmittedTransaction {
  if (!response.signature) {
    throw new Error('Sponsor response is missing signature');
  }

  return {
    signature: response.signature,
    status: response.status,
  };
}

export function normalizeInstruction(
  instruction: SolanaInstructionInput,
): SolanaInstruction {
  return {
    programId: instruction.programId,
    accounts: instruction.accounts.map((account) => ({
      pubkey: account.pubkey,
      isSigner: account.isSigner ?? false,
      isWritable: account.isWritable ?? false,
    })),
    data:
      typeof instruction.data === 'string'
        ? instruction.data
        : bytesToBase64(instruction.data),
  };
}

export function normalizeAmount(amount: Amount): string {
  return amount.toString();
}

export function toProtoNetwork(network: Network): Exclude<NetworkWire, number> {
  switch (network) {
    case 'devnet':
      return 'NETWORK_DEVNET';
    case 'mainnet':
      return 'NETWORK_MAINNET';
  }
}

export function normalizeNetwork(network?: NetworkWire): Network | undefined {
  switch (network) {
    case 'devnet':
    case 'NETWORK_DEVNET':
    case 1:
      return 'devnet';
    case 'mainnet':
    case 'NETWORK_MAINNET':
    case 2:
      return 'mainnet';
    default:
      return undefined;
  }
}

export function normalizeTransactionEncoding(
  encoding?: TransactionEncodingWire,
): TransactionEncoding | undefined {
  switch (encoding) {
    case 'base64':
    case 'TRANSACTION_ENCODING_BASE64':
    case 1:
      return 'base64';
    default:
      return undefined;
  }
}

function normalizePreparedTransactionKind(
  kind?: PreparedTransactionKindWire,
): PreparedTransactionKind | undefined {
  switch (kind) {
    case 'create-swig-wallet':
    case 'PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET':
    case 1:
      return 'create-swig-wallet';
    case 'add-authority':
    case 'PREPARED_TRANSACTION_KIND_ADD_AUTHORITY':
    case 2:
      return 'add-authority';
    case 'configure-recovery':
    case 'PREPARED_TRANSACTION_KIND_CONFIGURE_RECOVERY':
    case 3:
      return 'configure-recovery';
    default:
      return undefined;
  }
}

function normalizeSignatureRequests(
  requests?: ClientSignatureRequestWire[],
): ClientSignatureRequest[] {
  if (!requests) {
    return [];
  }

  return requests.map((request) => {
    const messageHash = request.messageHash ?? request.message_hash;
    const scheme = normalizeAuthoritySignatureScheme(request.scheme);

    if (
      !scheme ||
      !request.signer ||
      !messageHash ||
      request.slot === undefined ||
      request.counter === undefined
    ) {
      throw new Error('Prepared transaction has invalid signature request');
    }

    return {
      scheme,
      signer: request.signer,
      messageHash,
      slot:
        typeof request.slot === 'string'
          ? Number.parseInt(request.slot, 10)
          : request.slot,
      counter: request.counter,
    };
  });
}

function normalizeAuthoritySignatureScheme(
  scheme: ClientSignatureRequestWire['scheme'],
): ClientSignatureRequest['scheme'] | undefined {
  switch (scheme) {
    case 'AUTHORITY_SIGNATURE_SCHEME_SECP256R1':
    case 1:
      return 'secp256r1';
    case 'AUTHORITY_SIGNATURE_SCHEME_SECP256K1':
    case 2:
      return 'secp256k1';
    default:
      return undefined;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
