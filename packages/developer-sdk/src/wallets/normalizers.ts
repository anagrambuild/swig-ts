import type {
  Amount,
  Network,
  NetworkWire,
  PreparedTransaction,
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
