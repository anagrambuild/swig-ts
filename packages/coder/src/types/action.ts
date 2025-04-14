import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getDiscriminatedUnionDecoder,
  getDiscriminatedUnionEncoder,
  getStructDecoder,
  getStructEncoder,
  getUnitDecoder,
  getUnitEncoder,
} from '@solana/codecs';
import {
  // combineCodec,
  // fixDecoderSize,
  // fixEncoderSize,
  // getBytesDecoder,
  // getBytesEncoder,
  // getDiscriminatedUnionDecoder,
  // getDiscriminatedUnionEncoder,
  // getStructDecoder,
  // getStructEncoder,
  // getUnitDecoder,
  // getUnitEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type GetDiscriminatedUnionVariant,
  type GetDiscriminatedUnionVariantContent,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getSolActionDecoder,
  getSolActionEncoder,
  getTokenActionDecoder,
  getTokenActionEncoder,
  type SolAction,
  type TokenAction,
} from '.';

export type ActionKind = Action['__kind'];

export type Action =
  | { __kind: 'All' }
  | { __kind: 'ManageAuthority' }
  | { __kind: 'Tokens'; action: TokenAction }
  | { __kind: 'Token'; key: ReadonlyUint8Array; action: TokenAction }
  | { __kind: 'Sol'; action: SolAction }
  | { __kind: 'Program'; key: ReadonlyUint8Array };

export function getActionEncoder(): Encoder<Action> {
  return getDiscriminatedUnionEncoder([
    ['All', getUnitEncoder()],
    ['ManageAuthority', getUnitEncoder()],
    ['Tokens', getStructEncoder([['action', getTokenActionEncoder()]])],
    [
      'Token',
      getStructEncoder([
        ['key', fixEncoderSize(getBytesEncoder(), 32)],
        ['action', getTokenActionEncoder()],
      ]),
    ],
    ['Sol', getStructEncoder([['action', getSolActionEncoder()]])],
    [
      'Program',
      getStructEncoder([['key', fixEncoderSize(getBytesEncoder(), 32)]]),
    ],
  ]);
}

export function getActionDecoder(): Decoder<Action> {
  return getDiscriminatedUnionDecoder([
    ['All', getUnitDecoder()],
    ['ManageAuthority', getUnitDecoder()],
    ['Tokens', getStructDecoder([['action', getTokenActionDecoder()]])],
    [
      'Token',
      getStructDecoder([
        ['key', fixDecoderSize(getBytesDecoder(), 32)],
        ['action', getTokenActionDecoder()],
      ]),
    ],
    ['Sol', getStructDecoder([['action', getSolActionDecoder()]])],
    [
      'Program',
      getStructDecoder([['key', fixDecoderSize(getBytesDecoder(), 32)]]),
    ],
  ]);
}

export function getActionCodec(): Codec<Action, Action> {
  return combineCodec(getActionEncoder(), getActionDecoder());
}

// Data Enum Helpers.
export function action(
  kind: 'All',
): GetDiscriminatedUnionVariant<Action, '__kind', 'All'>;
export function action(
  kind: 'ManageAuthority',
): GetDiscriminatedUnionVariant<Action, '__kind', 'ManageAuthority'>;
export function action(
  kind: 'Tokens',
  data: GetDiscriminatedUnionVariantContent<Action, '__kind', 'Tokens'>,
): GetDiscriminatedUnionVariant<Action, '__kind', 'Tokens'>;
export function action(
  kind: 'Token',
  data: GetDiscriminatedUnionVariantContent<Action, '__kind', 'Token'>,
): GetDiscriminatedUnionVariant<Action, '__kind', 'Token'>;
export function action(
  kind: 'Sol',
  data: GetDiscriminatedUnionVariantContent<Action, '__kind', 'Sol'>,
): GetDiscriminatedUnionVariant<Action, '__kind', 'Sol'>;
export function action(
  kind: 'Program',
  data: GetDiscriminatedUnionVariantContent<Action, '__kind', 'Program'>,
): GetDiscriminatedUnionVariant<Action, '__kind', 'Program'>;
export function action<K extends Action['__kind'], Data>(kind: K, data?: Data) {
  return Array.isArray(data)
    ? { __kind: kind, fields: data }
    : { __kind: kind, ...(data ?? {}) };
}

export function isAction<K extends Action['__kind']>(
  kind: K,
  value: Action,
): value is Action & { __kind: K } {
  return value.__kind === kind;
}
