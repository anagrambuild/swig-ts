import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type TokenDestinationLimit = {
  mint: ReadonlyUint8Array;
  destination: ReadonlyUint8Array;
  amount: bigint;
};

export function getTokenDestinationLimitEncoder(): Encoder<TokenDestinationLimit> {
  return getStructEncoder([
    ['mint', fixEncoderSize(getBytesEncoder(), 32)],
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
    ['amount', getU64Encoder()],
  ]);
}

export function getTokenDestinationLimitDecoder(): Decoder<TokenDestinationLimit> {
  return getStructDecoder([
    ['mint', fixDecoderSize(getBytesDecoder(), 32)],
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
    ['amount', getU64Decoder()],
  ]);
}

export function getTokenDestinationLimitCodec(): Codec<
  TokenDestinationLimit,
  TokenDestinationLimit
> {
  return combineCodec(
    getTokenDestinationLimitEncoder(),
    getTokenDestinationLimitDecoder(),
  );
}
