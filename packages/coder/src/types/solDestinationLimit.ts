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

export type SolDestinationLimit = {
  amount: bigint;
  destination: ReadonlyUint8Array;
};

export function getSolDestinationLimitEncoder(): Encoder<SolDestinationLimit> {
  return getStructEncoder([
    ['amount', getU64Encoder()],
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
  ]);
}

export function getSolDestinationLimitDecoder(): Decoder<SolDestinationLimit> {
  return getStructDecoder([
    ['amount', getU64Decoder()],
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
  ]);
}

export function getSolDestinationLimitCodec(): Codec<
  SolDestinationLimit,
  SolDestinationLimit
> {
  return combineCodec(
    getSolDestinationLimitEncoder(),
    getSolDestinationLimitDecoder(),
  );
}
