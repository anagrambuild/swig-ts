import bs58 from 'bs58';
import type { HttpClient } from '../core/index.js';
import type {
  Network,
  SponsorSignedTransactionArgs,
  SubmittedTransaction,
  SubmittedTransactionWire,
} from '../types/index.js';
import { normalizeSubmittedTransaction } from '../wallets/normalizers.js';

export class TransactionsClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  sponsor = async (
    args: SponsorSignedTransactionArgs,
  ): Promise<SubmittedTransaction> => {
    const response = await this.http.post<SubmittedTransactionWire>(
      '/paymaster/sponsor',
      {
        base58_encoded_transaction: bs58.encode(
          base64ToBytes(args.transaction),
        ),
        network: args.network ?? this.defaultNetwork,
        idempotencyKey: args.idempotencyKey,
      },
    );

    return normalizeSubmittedTransaction(response);
  };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
