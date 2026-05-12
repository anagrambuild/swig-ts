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
      '/v1/transactions/sponsor',
      {
        intentId: args.intentId,
        transaction: args.transaction,
        transactionEncoding: args.transactionEncoding,
        network: args.network ?? this.defaultNetwork,
        metadata: args.metadata,
        idempotencyKey: args.idempotencyKey,
      },
    );

    return normalizeSubmittedTransaction(response);
  };
}
