import type {
  AddAuthorityChallenge,
  AddAuthorityChallengeWire,
  Amount,
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
  const intentId = response.intentId ?? response.intent_id;
  if (!intentId) {
    throw new Error('Backend response is missing intent_id');
  }

  const transaction =
    response.transaction ??
    response.unsignedTransaction ??
    response.unsigned_transaction;
  if (!transaction) {
    throw new Error('Prepared transaction response is missing transaction');
  }

  return {
    intentId,
    wallet: response.wallet,
    transaction,
    transactionEncoding: normalizeTransactionEncoding(
      response.transactionEncoding ?? response.transaction_encoding,
    ),
    expiresAt: response.expiresAt ?? response.expires_at,
    network: normalizeNetwork(response.network),
    recentBlockhash: response.recentBlockhash ?? response.recent_blockhash,
    kind: normalizePreparedTransactionKind(response.kind),
  };
}

export function normalizeCreateWalletResponse(
  response: CreateWalletResponseWire,
): CreateWalletResult {
  const topLevelIntentId = response.intentId ?? response.intent_id;
  const topLevelNetwork = normalizeNetwork(response.network);
  const transactions = Array.isArray(response.transactions)
    ? response.transactions.map((transaction) =>
        normalizePreparedTransaction({
          ...transaction,
          intentId:
            transaction.intentId ?? transaction.intent_id ?? topLevelIntentId,
          network: transaction.network ?? response.network,
        }),
      )
    : [normalizePreparedTransaction(response)];
  const creationTransaction =
    transactions.find(
      (transaction) => transaction.kind === 'create-swig-wallet',
    ) ?? transactions[0];
  const wallet = response.wallet ?? creationTransaction?.wallet;
  const intentId = topLevelIntentId ?? creationTransaction?.intentId;

  if (!intentId) {
    throw new Error('Create wallet response is missing intent_id');
  }
  if (!wallet) {
    throw new Error('Create wallet response is missing wallet');
  }

  return {
    intentId,
    wallet,
    transactions,
    creationTransaction,
    addAuthorityChallenge: normalizeAddAuthorityChallenge(
      response.addAuthorityChallenge ?? response.add_authority_challenge,
    ),
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
    intentId: response.intentId ?? response.intent_id,
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

function normalizeAddAuthorityChallenge(
  challenge?: AddAuthorityChallengeWire,
): AddAuthorityChallenge | undefined {
  if (!challenge) {
    return undefined;
  }

  const transactionIndex =
    challenge.transactionIndex ?? challenge.transaction_index;
  const messageHash = challenge.messageHash ?? challenge.message_hash;
  const scheme = normalizeAuthoritySignatureScheme(challenge.scheme);

  if (
    transactionIndex === undefined ||
    !scheme ||
    !challenge.signer ||
    !messageHash ||
    challenge.slot === undefined ||
    challenge.counter === undefined
  ) {
    throw new Error(
      'Create wallet response has invalid add_authority_challenge',
    );
  }

  return {
    transactionIndex,
    scheme,
    signer: challenge.signer,
    messageHash,
    slot:
      typeof challenge.slot === 'string'
        ? Number.parseInt(challenge.slot, 10)
        : challenge.slot,
    counter: challenge.counter,
  };
}

function normalizeAuthoritySignatureScheme(
  scheme: AddAuthorityChallengeWire['scheme'],
): AddAuthorityChallenge['scheme'] | undefined {
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
