import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import {
  PaymentPayloadV2Schema,
  PaymentRequiredV2Schema,
} from '@x402/core/schemas';
import type { PaymentPayload } from '@x402/core/types';

import type { SignedPreparedTransaction } from '../client/index.js';
import type { HttpClient } from '../core/index.js';
import type {
  Network,
  PaymentRequiredV2,
  PrepareX402PaymentOptions,
  PreparedTransactionWire,
  WalletReference,
  X402PaymentSubmission,
  X402PreparationResult,
} from '../types/index.js';
import {
  normalizePreparedTransaction,
  toProtoNetwork,
} from '../wallets/normalizers.js';

const MAX_SOLANA_TRANSACTION_BYTES = 1_232;
const MAX_PAYMENT_SIGNATURE_HEADER_BYTES = 8_000;
const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';

const X402_SOLANA_NETWORKS: Record<Network, string> = {
  devnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  mainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
};

export interface PrepareX402PaymentResponseWire {
  preparedTransaction?: PreparedTransactionWire;
  prepared_transaction?: PreparedTransactionWire;
  acceptedIndex?: unknown;
  accepted_index?: unknown;
}

export async function prepareX402PaymentFromResponse(
  http: HttpClient,
  wallet: WalletReference,
  defaultNetwork: Network | undefined,
  response: Response,
  options: PrepareX402PaymentOptions = {},
): Promise<X402PreparationResult> {
  const paymentRequired = parsePaymentRequiredFromResponse(response);

  return prepareX402Payment(
    http,
    wallet,
    defaultNetwork,
    paymentRequired,
    options.acceptedIndex,
  );
}

export async function prepareX402Payment(
  http: HttpClient,
  wallet: WalletReference,
  defaultNetwork: Network | undefined,
  paymentRequired: PaymentRequiredV2,
  requestedAcceptedIndex?: number,
): Promise<X402PreparationResult> {
  const validatedPaymentRequired = validatePaymentRequiredV2(paymentRequired);
  const network = resolveNetwork(wallet.network, defaultNetwork);
  const requesterAuthority = wallet.requesterAuthority;

  if (!requesterAuthority) {
    throw new Error('requesterAuthority is required');
  }

  const acceptedIndex = validateRequestedAcceptedIndex(
    requestedAcceptedIndex,
    validatedPaymentRequired,
  );
  const prepared = await http.post<PrepareX402PaymentResponseWire>(
    '/transaction/payment/x402/prepare',
    {
      paymentRequired: validatedPaymentRequired,
      ...(acceptedIndex === undefined ? {} : { acceptedIndex }),
      network: toProtoNetwork(network),
      swigAddress: wallet.swigConfigAddress,
      requesterAuthority,
    },
  );

  return normalizeX402PreparationResponse(
    prepared,
    validatedPaymentRequired,
    acceptedIndex,
    network,
    wallet.swigConfigAddress,
  );
}

export function parsePaymentRequiredFromResponse(
  response: Response,
): PaymentRequiredV2 {
  if (response.status !== 402) {
    throw new Error('x402 response must have status 402');
  }

  const header = response.headers.get(PAYMENT_REQUIRED_HEADER);
  if (!header) {
    throw new Error('x402 response is missing PAYMENT-REQUIRED');
  }

  let decoded: unknown;
  try {
    decoded = decodePaymentRequiredHeader(header);
  } catch {
    throw new Error('PAYMENT-REQUIRED is not valid x402 data');
  }

  return validatePaymentRequiredV2(decoded);
}

export function validatePaymentRequiredV2(value: unknown): PaymentRequiredV2 {
  const result = PaymentRequiredV2Schema.safeParse(value);
  if (!result.success) {
    throw new Error('PAYMENT-REQUIRED does not match the x402 v2 schema');
  }
  return result.data;
}

export function validateRequestedAcceptedIndex(
  acceptedIndex: number | undefined,
  paymentRequired: PaymentRequiredV2,
): number | undefined {
  if (acceptedIndex === undefined) {
    return undefined;
  }
  if (
    !Number.isInteger(acceptedIndex) ||
    acceptedIndex < 0 ||
    acceptedIndex > 0xffff_ffff
  ) {
    throw new Error('acceptedIndex must be a non-negative uint32');
  }
  if (acceptedIndex >= paymentRequired.accepts.length) {
    throw new Error('acceptedIndex is out of range');
  }
  return acceptedIndex;
}

export function normalizeX402PreparationResponse(
  response: PrepareX402PaymentResponseWire,
  paymentRequired: PaymentRequiredV2,
  requestedAcceptedIndex: number | undefined,
  network: Network,
  swigConfigAddress: string,
): X402PreparationResult {
  const preparedWire =
    response.preparedTransaction ?? response.prepared_transaction;
  if (!preparedWire) {
    throw new Error('x402 preparation response is missing preparedTransaction');
  }

  const acceptedIndex = readResponseAcceptedIndex(
    response.acceptedIndex ?? response.accepted_index,
  );
  if (acceptedIndex >= paymentRequired.accepts.length) {
    throw new Error('x402 preparation response acceptedIndex is out of range');
  }
  if (
    requestedAcceptedIndex !== undefined &&
    acceptedIndex !== requestedAcceptedIndex
  ) {
    throw new Error(
      'x402 preparation response selected a different requirement',
    );
  }

  const accepted = paymentRequired.accepts[acceptedIndex];
  if (
    accepted?.scheme !== 'exact' ||
    accepted.network !== X402_SOLANA_NETWORKS[network]
  ) {
    throw new Error(
      'x402 preparation response selected an unsupported requirement',
    );
  }

  const preparedTransaction = normalizePreparedTransaction(preparedWire);
  if (preparedTransaction.kind !== 'x402-payment') {
    throw new Error(
      'x402 preparation response has an invalid transaction kind',
    );
  }
  if (preparedTransaction.network !== network) {
    throw new Error('x402 preparation response has a different network');
  }
  if (preparedTransaction.transactionEncoding !== 'base64') {
    throw new Error('x402 preparation response must use base64');
  }
  if (preparedTransaction.wallet?.swigConfigAddress !== swigConfigAddress) {
    throw new Error('x402 preparation response has a different Swig wallet');
  }

  return {
    preparedTransaction,
    paymentRequired,
    acceptedIndex,
  };
}

export function createX402Payment(
  prepared: X402PreparationResult,
  signed: SignedPreparedTransaction,
): X402PaymentSubmission {
  const paymentRequired = validatePaymentRequiredV2(prepared.paymentRequired);
  const acceptedIndex = validateRequiredAcceptedIndex(
    prepared.acceptedIndex,
    paymentRequired,
  );

  if (prepared.preparedTransaction.kind !== 'x402-payment') {
    throw new Error('prepared transaction is not an x402 payment');
  }
  const network = prepared.preparedTransaction.network;
  if (!network) {
    throw new Error('prepared x402 transaction is missing network');
  }
  const accepted = paymentRequired.accepts[acceptedIndex];
  if (
    accepted?.scheme !== 'exact' ||
    accepted.network !== X402_SOLANA_NETWORKS[network]
  ) {
    throw new Error('prepared x402 requirement does not match its network');
  }
  if (signed.transactionEncoding !== 'base64') {
    throw new Error('signed x402 transaction must use base64');
  }
  if (signed.network !== undefined && signed.network !== network) {
    throw new Error('signed x402 transaction has a different network');
  }

  const transactionBytes = decodeCanonicalBase64(signed.transaction);
  if (transactionBytes.length === 0) {
    throw new Error('signed x402 transaction is empty');
  }
  if (transactionBytes.length > MAX_SOLANA_TRANSACTION_BYTES) {
    throw new Error('signed x402 transaction exceeds the Solana wire limit');
  }

  const candidate = {
    x402Version: paymentRequired.x402Version,
    resource: paymentRequired.resource,
    accepted,
    payload: { transaction: signed.transaction },
    ...(Object.hasOwn(paymentRequired, 'extensions')
      ? { extensions: paymentRequired.extensions }
      : {}),
  };
  const parsedPayload = PaymentPayloadV2Schema.safeParse(candidate);
  if (!parsedPayload.success) {
    throw new Error('x402 payment payload is invalid');
  }

  const paymentPayload = parsedPayload.data;
  const paymentSignature = encodePaymentSignatureHeader(
    paymentPayload as PaymentPayload,
  );
  if (
    new TextEncoder().encode(paymentSignature).length >
    MAX_PAYMENT_SIGNATURE_HEADER_BYTES
  ) {
    throw new Error('PAYMENT-SIGNATURE exceeds the supported header size');
  }

  return {
    paymentPayload,
    paymentSignatureHeaders: {
      'PAYMENT-SIGNATURE': paymentSignature,
    },
  };
}

function validateRequiredAcceptedIndex(
  acceptedIndex: number,
  paymentRequired: PaymentRequiredV2,
): number {
  const validated = validateRequestedAcceptedIndex(
    acceptedIndex,
    paymentRequired,
  );
  if (validated === undefined) {
    throw new Error('acceptedIndex is required');
  }
  return validated;
}

function readResponseAcceptedIndex(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xffff_ffff
  ) {
    throw new Error('x402 preparation response has an invalid acceptedIndex');
  }
  return value;
}

function resolveNetwork(
  walletNetwork: Network | undefined,
  defaultNetwork: Network | undefined,
): Network {
  const network = walletNetwork ?? defaultNetwork;
  if (!network) {
    throw new Error('network is required');
  }
  return network;
}

function decodeCanonicalBase64(value: string): Uint8Array {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new Error('signed x402 transaction is not canonical base64');
  }

  try {
    const decoded = atob(value);
    const bytes = Uint8Array.from(decoded, (character) =>
      character.charCodeAt(0),
    );
    if (encodeBase64(bytes) !== value) {
      throw new Error('non-canonical');
    }
    return bytes;
  } catch {
    throw new Error('signed x402 transaction is not canonical base64');
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
