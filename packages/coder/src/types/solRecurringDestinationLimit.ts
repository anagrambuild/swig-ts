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

export type SolRecurringDestinationLimit = {
  destination: ReadonlyUint8Array;
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
};

export function getSolRecurringDestinationLimitEncoder(): Encoder<SolRecurringDestinationLimit> {
  return getStructEncoder([
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
    ['recurringAmount', getU64Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
  ]);
}

export function getSolRecurringDestinationLimitDecoder(): Decoder<SolRecurringDestinationLimit> {
  return getStructDecoder([
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
    ['recurringAmount', getU64Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
  ]);
}

export function getSolRecurringDestinationLimitCodec(): Codec<
  SolRecurringDestinationLimit,
  SolRecurringDestinationLimit
> {
  return combineCodec(
    getSolRecurringDestinationLimitEncoder(),
    getSolRecurringDestinationLimitDecoder(),
  );
}
