import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU16Decoder,
  getU16Encoder,
  getU8Decoder,
  getU8Encoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

/** Length of every swig tail entry header. */
export const TAIL_HEADER_LENGTH = 8;

/**
 * Kinds of typed entries stored in the swig config account's tail, after the
 * roles. Unknown kinds may appear and must be skipped by length.
 */
export enum SwigTailKind {
  RentClaimer = 1,
  ActiveSubAccountCount = 2,
  AuthorizationLocks = 3,
  ConfigSeedPrefix = 4,
}

/** Current version of the authorization-lock tail entry. */
export const AUTHORIZATION_LOCKS_TAIL_VERSION = 1;

/**
 * Header of a swig tail entry: `[kind u8][version u8][valueLen u16][payload 4]`,
 * followed by `valueLen` bytes of value.
 */
export type SwigTailHeader = {
  kind: number;
  version: number;
  valueLen: number;
  payload: ReadonlyUint8Array;
};

export function getSwigTailHeaderEncoder(): Encoder<SwigTailHeader> {
  return getStructEncoder([
    ['kind', getU8Encoder()],
    ['version', getU8Encoder()],
    ['valueLen', getU16Encoder()],
    ['payload', fixEncoderSize(getBytesEncoder(), 4)],
  ]);
}

export function getSwigTailHeaderDecoder(): Decoder<SwigTailHeader> {
  return getStructDecoder([
    ['kind', getU8Decoder()],
    ['version', getU8Decoder()],
    ['valueLen', getU16Decoder()],
    ['payload', fixDecoderSize(getBytesDecoder(), 4)],
  ]);
}

export function getSwigTailHeaderCodec(): Codec<
  SwigTailHeader,
  SwigTailHeader
> {
  return combineCodec(getSwigTailHeaderEncoder(), getSwigTailHeaderDecoder());
}
