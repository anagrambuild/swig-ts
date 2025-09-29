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
  destination: ReadonlyUint8Array;
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
};

export function getTokenRecurringDestinationLimitEncoder(): Encoder<TokenRecurringDestinationLimit> {
  return getStructEncoder([
    ['mint', fixEncoderSize(getBytesEncoder(), 32)],
    ['destination', fixEncoderSize(getBytesEncoder(), 32)],
    ['recurringAmount', getU64Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
  ]);
}

export function getTokenRecurringDestinationLimitDecoder(): Decoder<TokenRecurringDestinationLimit> {
  return getStructDecoder([
    ['mint', fixDecoderSize(getBytesDecoder(), 32)],
    ['destination', fixDecoderSize(getBytesDecoder(), 32)],
    ['recurringAmount', getU64Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
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
