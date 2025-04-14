import {
  combineCodec,
  getDiscriminatedUnionDecoder,
  getDiscriminatedUnionEncoder,
  getStructDecoder,
  getStructEncoder,
  getTupleDecoder,
  getTupleEncoder,
  getU64Decoder,
  getU64Encoder,
  getUnitDecoder,
  getUnitEncoder,
} from '@solana/codecs';
import {
  // combineCodec,
  // getDiscriminatedUnionDecoder,
  // getDiscriminatedUnionEncoder,
  // getStructDecoder,
  // getStructEncoder,
  // getTupleDecoder,
  // getTupleEncoder,
  // getU64Decoder,
  // getU64Encoder,
  // getUnitDecoder,
  // getUnitEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type GetDiscriminatedUnionVariant,
  type GetDiscriminatedUnionVariantContent,
} from '@solana/kit';
export type TokenAction =
  | { __kind: 'All' }
  | { __kind: 'Manage'; fields: readonly [bigint] }
  | { __kind: 'Temporal'; fields: readonly [bigint, bigint, bigint] };

export function getTokenActionEncoder(): Encoder<TokenAction> {
  return getDiscriminatedUnionEncoder([
    ['All', getUnitEncoder()],
    [
      'Manage',
      getStructEncoder([['fields', getTupleEncoder([getU64Encoder()])]]),
    ],
    [
      'Temporal',
      getStructEncoder([
        [
          'fields',
          getTupleEncoder([getU64Encoder(), getU64Encoder(), getU64Encoder()]),
        ],
      ]),
    ],
  ]);
}

export function getTokenActionDecoder(): Decoder<TokenAction> {
  return getDiscriminatedUnionDecoder([
    ['All', getUnitDecoder()],
    [
      'Manage',
      getStructDecoder([['fields', getTupleDecoder([getU64Decoder()])]]),
    ],
    [
      'Temporal',
      getStructDecoder([
        [
          'fields',
          getTupleDecoder([getU64Decoder(), getU64Decoder(), getU64Decoder()]),
        ],
      ]),
    ],
  ]);
}

export function getTokenActionCodec(): Codec<TokenAction, TokenAction> {
  return combineCodec(getTokenActionEncoder(), getTokenActionDecoder());
}

// Data Enum Helpers.
export function tokenAction(
  kind: 'All',
): GetDiscriminatedUnionVariant<TokenAction, '__kind', 'All'>;
export function tokenAction(
  kind: 'Manage',
  data: GetDiscriminatedUnionVariantContent<
    TokenAction,
    '__kind',
    'Manage'
  >['fields'],
): GetDiscriminatedUnionVariant<TokenAction, '__kind', 'Manage'>;
export function tokenAction(
  kind: 'Temporal',
  data: GetDiscriminatedUnionVariantContent<
    TokenAction,
    '__kind',
    'Temporal'
  >['fields'],
): GetDiscriminatedUnionVariant<TokenAction, '__kind', 'Temporal'>;
export function tokenAction<K extends TokenAction['__kind'], Data>(
  kind: K,
  data?: Data,
) {
  return Array.isArray(data)
    ? { __kind: kind, fields: data }
    : { __kind: kind, ...(data ?? {}) };
}

export function isTokenAction<K extends TokenAction['__kind']>(
  kind: K,
  value: TokenAction,
): value is TokenAction & { __kind: K } {
  return value.__kind === kind;
}
