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
  destination: ReadonlyUint8Array;
  amount: bigint;
};

export function getSolDestinationLimitEncoder(): Encoder<SolDestinationLimit> {
  return getStructEncoder([
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
    ['amount', getU64Encoder()],
  ]);
}

export function getSolDestinationLimitDecoder(): Decoder<SolDestinationLimit> {
  return getStructDecoder([
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
    ['amount', getU64Decoder()],
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
