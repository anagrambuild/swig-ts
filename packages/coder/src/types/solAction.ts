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

export type SolAction =
  | { __kind: 'All' }
  | { __kind: 'Manage'; fields: readonly [bigint] }
  | { __kind: 'Temporal'; fields: readonly [bigint, bigint, bigint] };

export function getSolActionEncoder(): Encoder<SolAction> {
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

export function getSolActionDecoder(): Decoder<SolAction> {
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

export function getSolActionCodec(): Codec<SolAction, SolAction> {
  return combineCodec(getSolActionEncoder(), getSolActionDecoder());
}

// Data Enum Helpers.
export function solAction(
  kind: 'All',
): GetDiscriminatedUnionVariant<SolAction, '__kind', 'All'>;
export function solAction(
  kind: 'Manage',
  data: GetDiscriminatedUnionVariantContent<
    SolAction,
    '__kind',
    'Manage'
  >['fields'],
): GetDiscriminatedUnionVariant<SolAction, '__kind', 'Manage'>;
export function solAction(
  kind: 'Temporal',
  data: GetDiscriminatedUnionVariantContent<
    SolAction,
    '__kind',
    'Temporal'
  >['fields'],
): GetDiscriminatedUnionVariant<SolAction, '__kind', 'Temporal'>;
export function solAction<K extends SolAction['__kind'], Data>(
  kind: K,
  data?: Data,
) {
  return Array.isArray(data)
    ? { __kind: kind, fields: data }
    : { __kind: kind, ...(data ?? {}) };
}

export function isSolAction<K extends SolAction['__kind']>(
  kind: K,
  value: SolAction,
): value is SolAction & { __kind: K } {
  return value.__kind === kind;
}
