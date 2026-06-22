import type { HttpClient } from '../core/index.js';
import type {
  CreateRampSessionArgs,
  CreateRampSessionRequestWire,
  CreateRampSessionResult,
  CreateRampSessionResultWire,
  GetRampOptionsArgs,
  GetRampOptionsResult,
  GetRampOptionsResultWire,
  GetRampTransactionArgs,
  GetRampTransactionResult,
  GetRampTransactionResultWire,
  ListRampTransactionsArgs,
  ListRampTransactionsResult,
  ListRampTransactionsResultWire,
  Network,
  NetworkWire,
  QuoteRampArgs,
  QuoteRampRequestWire,
  QuoteRampResult,
  QuoteRampResultWire,
  RampCustomerContext,
  RampCustomerContextWire,
  RampCustomerTypeWire,
  RampDirection,
  RampDirectionWire,
  RampPaymentMethodType,
  RampPaymentMethodTypeWire,
  RampQuote,
  RampQuoteWire,
  RampServiceProvider,
  RampServiceProviderWire,
  RampTransaction,
  RampTransactionStatus,
  RampTransactionStatusWire,
  RampTransactionType,
  RampTransactionTypeWire,
  RampTransactionWire,
  RampWalletContext,
  RampWalletContextWire,
} from '../types/index.js';

export class RampClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  getOptions = async (
    args: GetRampOptionsArgs,
  ): Promise<GetRampOptionsResult> => {
    const response = await this.http.get<GetRampOptionsResultWire>(
      rampOptionsPath(args),
    );
    return normalizeRampOptions(response);
  };

  quote = async (args: QuoteRampArgs): Promise<QuoteRampResult> => {
    const response = await this.http.post<QuoteRampResultWire>(
      '/wallet/api/ramp/quote',
      quoteRampRequest(args),
    );
    return normalizeQuoteRampResult(response);
  };

  createSession = async (
    args: CreateRampSessionArgs,
  ): Promise<CreateRampSessionResult> => {
    const response = await this.http.post<CreateRampSessionResultWire>(
      '/wallet/api/ramp/sessions',
      createRampSessionRequest(args),
    );
    return normalizeCreateRampSessionResult(response);
  };

  getTransaction = async (
    args: GetRampTransactionArgs,
  ): Promise<GetRampTransactionResult> => {
    const response = await this.http.get<GetRampTransactionResultWire>(
      `/wallet/api/ramp/transactions/${encodeURIComponent(args.transactionId)}`,
    );
    return normalizeGetRampTransactionResult(response);
  };

  listTransactions = async (
    args: ListRampTransactionsArgs,
  ): Promise<ListRampTransactionsResult> => {
    const response = await this.http.get<ListRampTransactionsResultWire>(
      listRampTransactionsPath({
        ...args,
        network: args.network ?? this.defaultNetwork,
      }),
    );
    return normalizeListRampTransactionsResult(response);
  };
}

export function normalizeRampOptions(
  response: GetRampOptionsResultWire,
): GetRampOptionsResult {
  return {
    countryCodes: response.countryCodes ?? response.country_codes ?? [],
    fiatCurrencyCodes:
      response.fiatCurrencyCodes ?? response.fiat_currency_codes ?? [],
    paymentMethodTypes: (
      response.paymentMethodTypes ??
      response.payment_method_types ??
      []
    ).map(normalizeRampPaymentMethodType),
    cryptoCurrencyCodes:
      response.cryptoCurrencyCodes ?? response.crypto_currency_codes ?? [],
  };
}

export function normalizeQuoteRampResult(
  response: QuoteRampResultWire,
): QuoteRampResult {
  return {
    quotes: (response.quotes ?? []).map(normalizeRampQuote),
  };
}

export function normalizeCreateRampSessionResult(
  response: CreateRampSessionResultWire,
): CreateRampSessionResult {
  const fallbackLaunchUrl =
    response.fallbackLaunchUrl ?? response.fallback_launch_url;
  return {
    localSessionId: readString(
      response.localSessionId ?? response.local_session_id,
      'localSessionId',
    ),
    meldSessionId: readString(
      response.meldSessionId ?? response.meld_session_id,
      'meldSessionId',
    ),
    externalCustomerId: readString(
      response.externalCustomerId ?? response.external_customer_id,
      'externalCustomerId',
    ),
    externalSessionId: readString(
      response.externalSessionId ?? response.external_session_id,
      'externalSessionId',
    ),
    launchUrl: readString(
      response.launchUrl ?? response.launch_url,
      'launchUrl',
    ),
    ...(fallbackLaunchUrl ? { fallbackLaunchUrl } : {}),
  };
}

export function normalizeGetRampTransactionResult(
  response: GetRampTransactionResultWire,
): GetRampTransactionResult {
  return {
    ...(response.transaction
      ? { transaction: normalizeRampTransaction(response.transaction) }
      : {}),
  };
}

export function normalizeListRampTransactionsResult(
  response: ListRampTransactionsResultWire,
): ListRampTransactionsResult {
  return {
    transactions: (response.transactions ?? []).map(normalizeRampTransaction),
  };
}

function rampOptionsPath(args: GetRampOptionsArgs): string {
  return pathWithQuery('/wallet/api/ramp/options', {
    partnerApplicationId: args.partnerApplicationId,
    countryCode: args.countryCode,
    fiatCurrencyCode: args.fiatCurrencyCode,
  });
}

function listRampTransactionsPath(args: {
  walletId: string;
  network?: Network;
  direction?: Exclude<RampDirection, 'unspecified'>;
  status?: Exclude<RampTransactionStatus, 'unspecified'>;
  limit?: number;
}): string {
  if (!args.network) {
    throw new Error('network is required');
  }
  return pathWithQuery(
    `/wallet/api/ramp/wallets/${encodeURIComponent(args.walletId)}/transactions`,
    {
      network: networkToWire(args.network),
      direction:
        args.direction === undefined
          ? undefined
          : rampDirectionToWire(args.direction),
      status:
        args.status === undefined
          ? undefined
          : rampTransactionStatusToWire(args.status),
      limit: args.limit,
    },
  );
}

function quoteRampRequest(args: QuoteRampArgs): QuoteRampRequestWire {
  return {
    customer: rampCustomerContextRequest(args.customer),
    wallet: rampWalletContextRequest(args.wallet),
    direction: rampDirectionToWire(args.direction),
    sourceAmount: args.sourceAmount,
    sourceCurrencyCode: args.sourceCurrencyCode,
    destinationCurrencyCode: args.destinationCurrencyCode,
    countryCode: args.countryCode,
    subdivision: args.subdivision,
    paymentMethodType:
      args.paymentMethodType === undefined
        ? undefined
        : rampPaymentMethodTypeToWire(args.paymentMethodType),
    serviceProviders: (args.serviceProviders ?? []).map(
      rampServiceProviderToWire,
    ),
  };
}

function createRampSessionRequest(
  args: CreateRampSessionArgs,
): CreateRampSessionRequestWire {
  return {
    ...quoteRampRequest(args),
    selectedQuoteId: args.selectedQuoteId,
    serviceProvider: rampServiceProviderToWire(args.serviceProvider),
    redirectUrl: args.redirectUrl,
  };
}

function rampCustomerContextRequest(
  customer: RampCustomerContext,
): RampCustomerContextWire {
  return {
    partnerApplicationId: customer.partnerApplicationId,
    swigUserId: customer.swigUserId,
    externalCustomerId: customer.externalCustomerId,
    externalBusinessId: customer.externalBusinessId,
    customerType: rampCustomerTypeToWire(customer.customerType),
  };
}

function rampWalletContextRequest(
  wallet: RampWalletContext,
): RampWalletContextWire {
  return {
    walletId: wallet.walletId,
    walletAddress: wallet.walletAddress,
    network: networkToWire(wallet.network),
  };
}

function normalizeRampQuote(response: RampQuoteWire): RampQuote {
  const rampScore = response.rampScore ?? response.ramp_score;
  const lowKyc = response.lowKyc ?? response.low_kyc;
  return {
    quoteId: readString(response.quoteId ?? response.quote_id, 'quoteId'),
    direction: normalizeRampDirection(response.direction),
    serviceProvider: normalizeRampServiceProvider(
      response.serviceProvider ?? response.service_provider,
    ),
    paymentMethodType: normalizeRampPaymentMethodType(
      response.paymentMethodType ?? response.payment_method_type,
    ),
    sourceAmount: readString(
      response.sourceAmount ?? response.source_amount,
      'sourceAmount',
    ),
    sourceCurrencyCode: readString(
      response.sourceCurrencyCode ?? response.source_currency_code,
      'sourceCurrencyCode',
    ),
    destinationAmount: readString(
      response.destinationAmount ?? response.destination_amount,
      'destinationAmount',
    ),
    destinationCurrencyCode: readString(
      response.destinationCurrencyCode ?? response.destination_currency_code,
      'destinationCurrencyCode',
    ),
    exchangeRate: readString(
      response.exchangeRate ?? response.exchange_rate,
      'exchangeRate',
    ),
    totalFee: readString(response.totalFee ?? response.total_fee, 'totalFee'),
    networkFee: readString(
      response.networkFee ?? response.network_fee,
      'networkFee',
    ),
    transactionFee: readString(
      response.transactionFee ?? response.transaction_fee,
      'transactionFee',
    ),
    partnerFee: readString(
      response.partnerFee ?? response.partner_fee,
      'partnerFee',
    ),
    ...(rampScore ? { rampScore } : {}),
    ...(lowKyc === undefined ? {} : { lowKyc }),
  };
}

function normalizeRampTransaction(
  response: RampTransactionWire,
): RampTransaction {
  const meldTransactionId =
    response.meldTransactionId ?? response.meld_transaction_id;
  const meldSessionId = response.meldSessionId ?? response.meld_session_id;
  const paymentMethodType =
    response.paymentMethodType ?? response.payment_method_type;
  const destinationAmount =
    response.destinationAmount ?? response.destination_amount;
  return {
    transactionId: readString(
      response.transactionId ?? response.transaction_id,
      'transactionId',
    ),
    ...(meldTransactionId ? { meldTransactionId } : {}),
    ...(meldSessionId ? { meldSessionId } : {}),
    walletId: readString(response.walletId ?? response.wallet_id, 'walletId'),
    direction: normalizeRampDirection(response.direction),
    transactionType: normalizeRampTransactionType(
      response.transactionType ?? response.transaction_type,
    ),
    status: normalizeRampTransactionStatus(response.status),
    serviceProvider: normalizeRampServiceProvider(
      response.serviceProvider ?? response.service_provider,
    ),
    ...(paymentMethodType === undefined
      ? {}
      : {
          paymentMethodType: normalizeRampPaymentMethodType(paymentMethodType),
        }),
    sourceAmount: readString(
      response.sourceAmount ?? response.source_amount,
      'sourceAmount',
    ),
    sourceCurrencyCode: readString(
      response.sourceCurrencyCode ?? response.source_currency_code,
      'sourceCurrencyCode',
    ),
    ...(destinationAmount ? { destinationAmount } : {}),
    destinationCurrencyCode: readString(
      response.destinationCurrencyCode ?? response.destination_currency_code,
      'destinationCurrencyCode',
    ),
    createdAt: readString(
      response.createdAt ?? response.created_at,
      'createdAt',
    ),
    updatedAt: readString(
      response.updatedAt ?? response.updated_at,
      'updatedAt',
    ),
  };
}

function rampDirectionToWire(direction: RampDirectionWire): RampDirectionWire {
  switch (direction) {
    case 'onramp':
    case 'RAMP_DIRECTION_ONRAMP':
    case 1:
      return 'RAMP_DIRECTION_ONRAMP';
    case 'offramp':
    case 'RAMP_DIRECTION_OFFRAMP':
    case 2:
      return 'RAMP_DIRECTION_OFFRAMP';
    case 'transfer':
    case 'RAMP_DIRECTION_TRANSFER':
    case 3:
      return 'RAMP_DIRECTION_TRANSFER';
    case 'unspecified':
    case 'RAMP_DIRECTION_UNSPECIFIED':
    case 0:
      return 'RAMP_DIRECTION_UNSPECIFIED';
    default:
      throw new Error('Invalid ramp direction');
  }
}

function rampCustomerTypeToWire(
  customerType: RampCustomerTypeWire,
): RampCustomerTypeWire {
  switch (customerType) {
    case 'individual':
    case 'RAMP_CUSTOMER_TYPE_INDIVIDUAL':
    case 1:
      return 'RAMP_CUSTOMER_TYPE_INDIVIDUAL';
    case 'business':
    case 'RAMP_CUSTOMER_TYPE_BUSINESS':
    case 2:
      return 'RAMP_CUSTOMER_TYPE_BUSINESS';
    case 'unspecified':
    case 'RAMP_CUSTOMER_TYPE_UNSPECIFIED':
    case 0:
      return 'RAMP_CUSTOMER_TYPE_UNSPECIFIED';
    default:
      throw new Error('Invalid ramp customer type');
  }
}

function rampServiceProviderToWire(
  provider: RampServiceProviderWire,
): RampServiceProviderWire {
  switch (provider) {
    case 'other':
    case 'RAMP_SERVICE_PROVIDER_OTHER':
    case 1:
      return 'RAMP_SERVICE_PROVIDER_OTHER';
    case 'unspecified':
    case 'RAMP_SERVICE_PROVIDER_UNSPECIFIED':
    case 0:
      return 'RAMP_SERVICE_PROVIDER_UNSPECIFIED';
    default:
      throw new Error('Invalid ramp service provider');
  }
}

function rampPaymentMethodTypeToWire(
  paymentMethodType: RampPaymentMethodTypeWire,
): RampPaymentMethodTypeWire {
  switch (paymentMethodType) {
    case 'other':
    case 'RAMP_PAYMENT_METHOD_TYPE_OTHER':
    case 1:
      return 'RAMP_PAYMENT_METHOD_TYPE_OTHER';
    case 'credit-debit-card':
    case 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD':
    case 2:
      return 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD';
    case 'ach':
    case 'RAMP_PAYMENT_METHOD_TYPE_ACH':
    case 3:
      return 'RAMP_PAYMENT_METHOD_TYPE_ACH';
    case 'bank-transfer':
    case 'RAMP_PAYMENT_METHOD_TYPE_BANK_TRANSFER':
    case 4:
      return 'RAMP_PAYMENT_METHOD_TYPE_BANK_TRANSFER';
    case 'apple-pay':
    case 'RAMP_PAYMENT_METHOD_TYPE_APPLE_PAY':
    case 5:
      return 'RAMP_PAYMENT_METHOD_TYPE_APPLE_PAY';
    case 'google-pay':
    case 'RAMP_PAYMENT_METHOD_TYPE_GOOGLE_PAY':
    case 6:
      return 'RAMP_PAYMENT_METHOD_TYPE_GOOGLE_PAY';
    case 'pix':
    case 'RAMP_PAYMENT_METHOD_TYPE_PIX':
    case 7:
      return 'RAMP_PAYMENT_METHOD_TYPE_PIX';
    case 'unspecified':
    case 'RAMP_PAYMENT_METHOD_TYPE_UNSPECIFIED':
    case 0:
      return 'RAMP_PAYMENT_METHOD_TYPE_UNSPECIFIED';
    default:
      throw new Error('Invalid ramp payment method type');
  }
}

function rampTransactionStatusToWire(
  status: RampTransactionStatusWire,
): RampTransactionStatusWire {
  switch (status) {
    case 'created':
    case 'RAMP_TRANSACTION_STATUS_CREATED':
    case 1:
      return 'RAMP_TRANSACTION_STATUS_CREATED';
    case 'pending':
    case 'RAMP_TRANSACTION_STATUS_PENDING':
    case 2:
      return 'RAMP_TRANSACTION_STATUS_PENDING';
    case 'settling':
    case 'RAMP_TRANSACTION_STATUS_SETTLING':
    case 3:
      return 'RAMP_TRANSACTION_STATUS_SETTLING';
    case 'settled':
    case 'RAMP_TRANSACTION_STATUS_SETTLED':
    case 4:
      return 'RAMP_TRANSACTION_STATUS_SETTLED';
    case 'failed':
    case 'RAMP_TRANSACTION_STATUS_FAILED':
    case 5:
      return 'RAMP_TRANSACTION_STATUS_FAILED';
    case 'declined':
    case 'RAMP_TRANSACTION_STATUS_DECLINED':
    case 6:
      return 'RAMP_TRANSACTION_STATUS_DECLINED';
    case 'cancelled':
    case 'RAMP_TRANSACTION_STATUS_CANCELLED':
    case 7:
      return 'RAMP_TRANSACTION_STATUS_CANCELLED';
    case 'refunded':
    case 'RAMP_TRANSACTION_STATUS_REFUNDED':
    case 8:
      return 'RAMP_TRANSACTION_STATUS_REFUNDED';
    case 'unspecified':
    case 'RAMP_TRANSACTION_STATUS_UNSPECIFIED':
    case 0:
      return 'RAMP_TRANSACTION_STATUS_UNSPECIFIED';
    default:
      throw new Error('Invalid ramp transaction status');
  }
}

function networkToWire(network: NetworkWire): NetworkWire {
  switch (network) {
    case 'devnet':
    case 'NETWORK_DEVNET':
    case 1:
      return 'NETWORK_DEVNET';
    case 'mainnet':
    case 'NETWORK_MAINNET':
    case 2:
      return 'NETWORK_MAINNET';
    case 'NETWORK_UNSPECIFIED':
    case 0:
      return 'NETWORK_UNSPECIFIED';
    default:
      throw new Error('Invalid network');
  }
}

function normalizeRampDirection(direction?: RampDirectionWire): RampDirection {
  switch (direction) {
    case 'onramp':
    case 'RAMP_DIRECTION_ONRAMP':
    case 1:
      return 'onramp';
    case 'offramp':
    case 'RAMP_DIRECTION_OFFRAMP':
    case 2:
      return 'offramp';
    case 'transfer':
    case 'RAMP_DIRECTION_TRANSFER':
    case 3:
      return 'transfer';
    case 'unspecified':
    case 'RAMP_DIRECTION_UNSPECIFIED':
    case 0:
    case undefined:
      return 'unspecified';
    default:
      throw new Error('Ramp response has invalid direction');
  }
}

function normalizeRampServiceProvider(
  provider?: RampServiceProviderWire,
): RampServiceProvider {
  switch (provider) {
    case 'other':
    case 'RAMP_SERVICE_PROVIDER_OTHER':
    case 1:
      return 'other';
    case 'unspecified':
    case 'RAMP_SERVICE_PROVIDER_UNSPECIFIED':
    case 0:
    case undefined:
      return 'unspecified';
    default:
      throw new Error('Ramp response has invalid serviceProvider');
  }
}

function normalizeRampPaymentMethodType(
  paymentMethodType?: RampPaymentMethodTypeWire,
): RampPaymentMethodType {
  switch (paymentMethodType) {
    case 'other':
    case 'RAMP_PAYMENT_METHOD_TYPE_OTHER':
    case 1:
      return 'other';
    case 'credit-debit-card':
    case 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD':
    case 2:
      return 'credit-debit-card';
    case 'ach':
    case 'RAMP_PAYMENT_METHOD_TYPE_ACH':
    case 3:
      return 'ach';
    case 'bank-transfer':
    case 'RAMP_PAYMENT_METHOD_TYPE_BANK_TRANSFER':
    case 4:
      return 'bank-transfer';
    case 'apple-pay':
    case 'RAMP_PAYMENT_METHOD_TYPE_APPLE_PAY':
    case 5:
      return 'apple-pay';
    case 'google-pay':
    case 'RAMP_PAYMENT_METHOD_TYPE_GOOGLE_PAY':
    case 6:
      return 'google-pay';
    case 'pix':
    case 'RAMP_PAYMENT_METHOD_TYPE_PIX':
    case 7:
      return 'pix';
    case 'unspecified':
    case 'RAMP_PAYMENT_METHOD_TYPE_UNSPECIFIED':
    case 0:
    case undefined:
      return 'unspecified';
    default:
      throw new Error('Ramp response has invalid paymentMethodType');
  }
}

function normalizeRampTransactionType(
  transactionType?: RampTransactionTypeWire,
): RampTransactionType {
  switch (transactionType) {
    case 'crypto-purchase':
    case 'RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE':
    case 1:
      return 'crypto-purchase';
    case 'crypto-sell':
    case 'RAMP_TRANSACTION_TYPE_CRYPTO_SELL':
    case 2:
      return 'crypto-sell';
    case 'crypto-purchase-swap':
    case 'RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE_SWAP':
    case 3:
      return 'crypto-purchase-swap';
    case 'crypto-sell-swap':
    case 'RAMP_TRANSACTION_TYPE_CRYPTO_SELL_SWAP':
    case 4:
      return 'crypto-sell-swap';
    case 'transfer':
    case 'RAMP_TRANSACTION_TYPE_TRANSFER':
    case 5:
      return 'transfer';
    case 'unspecified':
    case 'RAMP_TRANSACTION_TYPE_UNSPECIFIED':
    case 0:
    case undefined:
      return 'unspecified';
    default:
      throw new Error('Ramp response has invalid transactionType');
  }
}

function normalizeRampTransactionStatus(
  status?: RampTransactionStatusWire,
): RampTransactionStatus {
  switch (status) {
    case 'created':
    case 'RAMP_TRANSACTION_STATUS_CREATED':
    case 1:
      return 'created';
    case 'pending':
    case 'RAMP_TRANSACTION_STATUS_PENDING':
    case 2:
      return 'pending';
    case 'settling':
    case 'RAMP_TRANSACTION_STATUS_SETTLING':
    case 3:
      return 'settling';
    case 'settled':
    case 'RAMP_TRANSACTION_STATUS_SETTLED':
    case 4:
      return 'settled';
    case 'failed':
    case 'RAMP_TRANSACTION_STATUS_FAILED':
    case 5:
      return 'failed';
    case 'declined':
    case 'RAMP_TRANSACTION_STATUS_DECLINED':
    case 6:
      return 'declined';
    case 'cancelled':
    case 'RAMP_TRANSACTION_STATUS_CANCELLED':
    case 7:
      return 'cancelled';
    case 'refunded':
    case 'RAMP_TRANSACTION_STATUS_REFUNDED':
    case 8:
      return 'refunded';
    case 'unspecified':
    case 'RAMP_TRANSACTION_STATUS_UNSPECIFIED':
    case 0:
    case undefined:
      return 'unspecified';
    default:
      throw new Error('Ramp response has invalid status');
  }
}

function pathWithQuery(
  path: string,
  query: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.size > 0 ? `${path}?${params.toString()}` : path;
}

function readString(value: unknown, field: string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new Error(`Ramp response is missing ${field}`);
}
