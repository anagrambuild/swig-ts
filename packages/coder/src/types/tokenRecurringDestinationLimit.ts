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

export type TokenRecurringDestinationLimit = {
  mint: ReadonlyUint8Array;
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
  destination: ReadonlyUint8Array;
};

export function getTokenRecurringDestinationLimitEncoder(): Encoder<TokenRecurringDestinationLimit> {
  return getStructEncoder([
    ['mint', fixEncoderSize(getBytesEncoder(), 32)],
    ['window', getU64Encoder()],
    ['recurringAmount', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
  ]);
}

export function getTokenRecurringDestinationLimitDecoder(): Decoder<TokenRecurringDestinationLimit> {
  return getStructDecoder([
    ['mint', fixDecoderSize(getBytesDecoder(), 32)],
    ['window', getU64Decoder()],
    ['recurringAmount', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
  ]);
}

export function getTokenRecurringDestinationLimitCodec(): Codec<
  TokenRecurringDestinationLimit,
  TokenRecurringDestinationLimit
> {
  return combineCodec(
    getTokenRecurringDestinationLimitEncoder(),
    getTokenRecurringDestinationLimitDecoder(),
  );
}
