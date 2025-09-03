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
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
  destination: ReadonlyUint8Array;
};

export function getSolRecurringDestinationLimitEncoder(): Encoder<SolRecurringDestinationLimit> {
  return getStructEncoder([
    ['recurringAmount', getU64Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
  ]);
}

export function getSolRecurringDestinationLimitDecoder(): Decoder<SolRecurringDestinationLimit> {
  return getStructDecoder([
    ['recurringAmount', getU64Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
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
