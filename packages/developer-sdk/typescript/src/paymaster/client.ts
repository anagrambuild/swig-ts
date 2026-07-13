import type { HttpClient } from '../core/index.js';
import type {
  GetPaymasterBalanceArgs,
  Network,
  PaymasterBalance,
  PaymasterBalanceWire,
  PaymasterKind,
  PaymasterKindWire,
} from '../types/index.js';

export class PaymasterClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  getBalance = async (
    args: GetPaymasterBalanceArgs = {},
  ): Promise<PaymasterBalance> => {
    const response = await this.http.get<PaymasterBalanceWire>(
      paymasterBalancePath({
        network: args.network ?? this.defaultNetwork,
        kind: args.kind,
      }),
    );
    return normalizePaymasterBalance(response);
  };

  getIdpBalance = async (
    args: Omit<GetPaymasterBalanceArgs, 'kind'> = {},
  ): Promise<PaymasterBalance> => {
    return this.getBalance({ ...args, kind: 'idp' });
  };
}

function paymasterBalancePath(args: GetPaymasterBalanceArgs): string {
  const params = new URLSearchParams();
  if (args.network) {
    params.set('network', args.network);
  }
  if (args.kind) {
    params.set('kind', paymasterKindQueryValue(args.kind));
  }
  if (params.size === 0) {
    return '/paymaster/balance';
  }
  return `/paymaster/balance?${params.toString()}`;
}

function paymasterKindQueryValue(
  kind: NonNullable<GetPaymasterBalanceArgs['kind']>,
): string {
  switch (kind) {
    case 'api':
      return 'PAYMASTER_KIND_API';
    case 'idp':
      return 'PAYMASTER_KIND_IDP';
  }
}

function normalizePaymasterBalance(
  response: PaymasterBalanceWire,
): PaymasterBalance {
  return {
    configured: response.configured ?? false,
    kind: normalizePaymasterKind(response.kind),
    id: response.id ?? '',
    address: response.address ?? '',
    label: response.label ?? '',
    balanceLamports: stringField(
      response.balanceLamports ?? response.balance_lamports ?? '0',
    ),
    balanceSol: numberField(
      response.balanceSol ?? response.balance_sol ?? 0,
      'balanceSol',
    ),
  };
}

function normalizePaymasterKind(kind?: PaymasterKindWire): PaymasterKind {
  switch (kind) {
    case 'api':
    case 'PAYMASTER_KIND_API':
    case 1:
      return 'api';
    case 'idp':
    case 'PAYMASTER_KIND_IDP':
    case 2:
      return 'idp';
    case 'unspecified':
    case 'PAYMASTER_KIND_UNSPECIFIED':
    case 0:
    case undefined:
      return 'unspecified';
    default:
      throw new Error('Paymaster balance response has invalid kind');
  }
}

function stringField(value: number | string): string {
  return String(value);
}

function numberField(value: number | string, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  throw new Error(`Paymaster balance response is missing ${field}`);
}
