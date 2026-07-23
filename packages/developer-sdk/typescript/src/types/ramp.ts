import type { Network } from './common.js';
import type { NetworkWire } from './transaction.js';

export type RampDirection = 'onramp' | 'offramp' | 'transfer' | 'unspecified';
export type RampDirectionWire =
  | RampDirection
  | 'RAMP_DIRECTION_UNSPECIFIED'
  | 'RAMP_DIRECTION_ONRAMP'
  | 'RAMP_DIRECTION_OFFRAMP'
  | 'RAMP_DIRECTION_TRANSFER'
  | number;

export type RampCustomerType = 'individual' | 'business' | 'unspecified';
export type RampCustomerTypeWire =
  | RampCustomerType
  | 'RAMP_CUSTOMER_TYPE_UNSPECIFIED'
  | 'RAMP_CUSTOMER_TYPE_INDIVIDUAL'
  | 'RAMP_CUSTOMER_TYPE_BUSINESS'
  | number;

export type RampTransactionType =
  | 'crypto-purchase'
  | 'crypto-sell'
  | 'crypto-purchase-swap'
  | 'crypto-sell-swap'
  | 'transfer'
  | 'unspecified';
export type RampTransactionTypeWire =
  | RampTransactionType
  | 'RAMP_TRANSACTION_TYPE_UNSPECIFIED'
  | 'RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE'
  | 'RAMP_TRANSACTION_TYPE_CRYPTO_SELL'
  | 'RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE_SWAP'
  | 'RAMP_TRANSACTION_TYPE_CRYPTO_SELL_SWAP'
  | 'RAMP_TRANSACTION_TYPE_TRANSFER'
  | number;

export type RampTransactionStatus =
  | 'created'
  | 'pending'
  | 'settling'
  | 'settled'
  | 'failed'
  | 'declined'
  | 'cancelled'
  | 'refunded'
  | 'unspecified';
export type RampTransactionStatusWire =
  | RampTransactionStatus
  | 'RAMP_TRANSACTION_STATUS_UNSPECIFIED'
  | 'RAMP_TRANSACTION_STATUS_CREATED'
  | 'RAMP_TRANSACTION_STATUS_PENDING'
  | 'RAMP_TRANSACTION_STATUS_SETTLING'
  | 'RAMP_TRANSACTION_STATUS_SETTLED'
  | 'RAMP_TRANSACTION_STATUS_FAILED'
  | 'RAMP_TRANSACTION_STATUS_DECLINED'
  | 'RAMP_TRANSACTION_STATUS_CANCELLED'
  | 'RAMP_TRANSACTION_STATUS_REFUNDED'
  | number;

export type RampServiceProvider = 'other' | 'unspecified';
export type RampServiceProviderWire =
  | RampServiceProvider
  | 'RAMP_SERVICE_PROVIDER_UNSPECIFIED'
  | 'RAMP_SERVICE_PROVIDER_OTHER'
  | number;

export type RampPaymentMethodType =
  | 'other'
  | 'credit-debit-card'
  | 'ach'
  | 'bank-transfer'
  | 'apple-pay'
  | 'google-pay'
  | 'pix'
  | 'unspecified';
export type RampPaymentMethodTypeWire =
  | RampPaymentMethodType
  | 'RAMP_PAYMENT_METHOD_TYPE_UNSPECIFIED'
  | 'RAMP_PAYMENT_METHOD_TYPE_OTHER'
  | 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD'
  | 'RAMP_PAYMENT_METHOD_TYPE_ACH'
  | 'RAMP_PAYMENT_METHOD_TYPE_BANK_TRANSFER'
  | 'RAMP_PAYMENT_METHOD_TYPE_APPLE_PAY'
  | 'RAMP_PAYMENT_METHOD_TYPE_GOOGLE_PAY'
  | 'RAMP_PAYMENT_METHOD_TYPE_PIX'
  | number;

export interface RampCustomerContext {
  partnerApplicationId?: string;
  swigUserId?: string;
  externalCustomerId?: string;
  externalBusinessId?: string;
  customerType: RampCustomerType;
}

export interface RampCustomerContextWire {
  organization_id?: string;
  organizationId?: string;
  partner_application_id?: string;
  partnerApplicationId?: string;
  swig_user_id?: string;
  swigUserId?: string;
  external_customer_id?: string;
  externalCustomerId?: string;
  external_business_id?: string;
  externalBusinessId?: string;
  customer_type?: RampCustomerTypeWire;
  customerType?: RampCustomerTypeWire;
}

export interface RampWalletContext {
  walletId: string;
  walletAddress: string;
  network: Network;
}

export interface RampWalletContextWire {
  wallet_id?: string;
  walletId?: string;
  wallet_address?: string;
  walletAddress?: string;
  network?: NetworkWire;
}

export interface GetRampOptionsArgs {
  partnerApplicationId?: string;
  countryCode?: string;
  fiatCurrencyCode?: string;
}

export interface RampSubdivisionOption {
  subdivisionCode: string;
  subdivisionName: string;
}

export interface RampSubdivisionOptionWire {
  subdivision_code?: string;
  subdivisionCode?: string;
  subdivision_name?: string;
  subdivisionName?: string;
}

export interface RampCountryOption {
  countryCode: string;
  countryName: string;
  subdivisions: RampSubdivisionOption[];
}

export interface RampCountryOptionWire {
  country_code?: string;
  countryCode?: string;
  country_name?: string;
  countryName?: string;
  subdivisions?: RampSubdivisionOptionWire[];
}

export interface GetRampOptionsResult {
  countryCodes: string[];
  countries: RampCountryOption[];
  fiatCurrencyCodes: string[];
  paymentMethodTypes: RampPaymentMethodType[];
  cryptoCurrencyCodes: string[];
}

export interface GetRampOptionsResultWire {
  country_codes?: string[];
  countryCodes?: string[];
  countries?: RampCountryOptionWire[];
  fiat_currency_codes?: string[];
  fiatCurrencyCodes?: string[];
  payment_method_types?: RampPaymentMethodTypeWire[];
  paymentMethodTypes?: RampPaymentMethodTypeWire[];
  crypto_currency_codes?: string[];
  cryptoCurrencyCodes?: string[];
}

export interface QuoteRampArgs {
  customer: RampCustomerContext;
  wallet: RampWalletContext;
  direction: Exclude<RampDirection, 'unspecified'>;
  sourceAmount: string;
  sourceCurrencyCode: string;
  destinationCurrencyCode: string;
  countryCode: string;
  subdivision?: string;
  paymentMethodType?: RampPaymentMethodType;
  serviceProviders?: RampServiceProvider[];
}

export interface QuoteRampRequestWire {
  customer?: RampCustomerContextWire;
  wallet?: RampWalletContextWire;
  direction?: RampDirectionWire;
  sourceAmount?: string;
  source_amount?: string;
  sourceCurrencyCode?: string;
  source_currency_code?: string;
  destinationCurrencyCode?: string;
  destination_currency_code?: string;
  countryCode?: string;
  country_code?: string;
  subdivision?: string;
  paymentMethodType?: RampPaymentMethodTypeWire;
  payment_method_type?: RampPaymentMethodTypeWire;
  serviceProviders?: RampServiceProviderWire[];
  service_providers?: RampServiceProviderWire[];
}

export interface RampQuote {
  quoteId: string;
  direction: RampDirection;
  serviceProvider: RampServiceProvider;
  paymentMethodType: RampPaymentMethodType;
  sourceAmount: string;
  sourceCurrencyCode: string;
  destinationAmount: string;
  destinationCurrencyCode: string;
  exchangeRate: string;
  totalFee: string;
  networkFee: string;
  transactionFee: string;
  partnerFee: string;
  rampScore?: string;
  lowKyc?: boolean;
  serviceProviderCode: string;
}

export interface RampQuoteWire {
  quote_id?: string;
  quoteId?: string;
  direction?: RampDirectionWire;
  service_provider?: RampServiceProviderWire;
  serviceProvider?: RampServiceProviderWire;
  payment_method_type?: RampPaymentMethodTypeWire;
  paymentMethodType?: RampPaymentMethodTypeWire;
  source_amount?: string;
  sourceAmount?: string;
  source_currency_code?: string;
  sourceCurrencyCode?: string;
  destination_amount?: string;
  destinationAmount?: string;
  destination_currency_code?: string;
  destinationCurrencyCode?: string;
  exchange_rate?: string;
  exchangeRate?: string;
  total_fee?: string;
  totalFee?: string;
  network_fee?: string;
  networkFee?: string;
  transaction_fee?: string;
  transactionFee?: string;
  partner_fee?: string;
  partnerFee?: string;
  ramp_score?: string;
  rampScore?: string;
  low_kyc?: boolean;
  lowKyc?: boolean;
  service_provider_code?: string;
  serviceProviderCode?: string;
}

export interface QuoteRampResult {
  quotes: RampQuote[];
}

export interface QuoteRampResultWire {
  quotes?: RampQuoteWire[];
}

export interface CreateRampSessionArgs {
  customer: RampCustomerContext;
  wallet: RampWalletContext;
  direction: Exclude<RampDirection, 'unspecified'>;
  selectedQuoteId: string;
  sourceAmount: string;
  sourceCurrencyCode: string;
  destinationCurrencyCode: string;
  countryCode: string;
  subdivision?: string;
  serviceProvider: RampServiceProvider;
  paymentMethodType?: RampPaymentMethodType;
  redirectUrl?: string;
}

export interface CreateRampSessionRequestWire extends QuoteRampRequestWire {
  selectedQuoteId?: string;
  selected_quote_id?: string;
  serviceProvider?: RampServiceProviderWire;
  service_provider?: RampServiceProviderWire;
  redirectUrl?: string;
  redirect_url?: string;
}

export interface CreateRampSessionResult {
  localSessionId: string;
  meldSessionId: string;
  externalCustomerId: string;
  externalSessionId: string;
  launchUrl: string;
  fallbackLaunchUrl?: string;
}

export interface CreateRampSessionResultWire {
  local_session_id?: string;
  localSessionId?: string;
  meld_session_id?: string;
  meldSessionId?: string;
  external_customer_id?: string;
  externalCustomerId?: string;
  external_session_id?: string;
  externalSessionId?: string;
  launch_url?: string;
  launchUrl?: string;
  fallback_launch_url?: string;
  fallbackLaunchUrl?: string;
}

export interface RampTransaction {
  transactionId: string;
  meldTransactionId?: string;
  meldSessionId?: string;
  walletId: string;
  direction: RampDirection;
  transactionType: RampTransactionType;
  status: RampTransactionStatus;
  serviceProvider: RampServiceProvider;
  paymentMethodType?: RampPaymentMethodType;
  sourceAmount: string;
  sourceCurrencyCode: string;
  destinationAmount?: string;
  destinationCurrencyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface RampTransactionWire {
  transaction_id?: string;
  transactionId?: string;
  meld_transaction_id?: string;
  meldTransactionId?: string;
  meld_session_id?: string;
  meldSessionId?: string;
  wallet_id?: string;
  walletId?: string;
  direction?: RampDirectionWire;
  transaction_type?: RampTransactionTypeWire;
  transactionType?: RampTransactionTypeWire;
  status?: RampTransactionStatusWire;
  service_provider?: RampServiceProviderWire;
  serviceProvider?: RampServiceProviderWire;
  payment_method_type?: RampPaymentMethodTypeWire;
  paymentMethodType?: RampPaymentMethodTypeWire;
  source_amount?: string;
  sourceAmount?: string;
  source_currency_code?: string;
  sourceCurrencyCode?: string;
  destination_amount?: string;
  destinationAmount?: string;
  destination_currency_code?: string;
  destinationCurrencyCode?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface GetRampTransactionArgs {
  transactionId: string;
}

export interface GetRampTransactionResult {
  transaction?: RampTransaction;
}

export interface GetRampTransactionResultWire {
  transaction?: RampTransactionWire;
}

export interface ListRampTransactionsArgs {
  walletId: string;
  network?: Network;
  direction?: Exclude<RampDirection, 'unspecified'>;
  status?: Exclude<RampTransactionStatus, 'unspecified'>;
  limit?: number;
}

export interface ListRampTransactionsResult {
  transactions: RampTransaction[];
}

export interface ListRampTransactionsResultWire {
  transactions?: RampTransactionWire[];
}
