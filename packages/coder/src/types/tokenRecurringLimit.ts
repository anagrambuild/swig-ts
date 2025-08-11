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

export type TokenRecurringLimit = {
  mint: ReadonlyUint8Array;
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
};

export function getTokenRecurringLimitEncoder(): Encoder<TokenRecurringLimit> {
  return getStructEncoder([
    ['mint', fixEncoderSize(getBytesEncoder(), 32)],
    ['window', getU64Encoder()],
    ['recurringAmount', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
    ['lastReset', getU64Encoder()],
  ]);
}

export function getTokenRecurringLimitDecoder(): Decoder<TokenRecurringLimit> {
  return getStructDecoder([
    ['mint', fixDecoderSize(getBytesDecoder(), 32)],
    ['window', getU64Decoder()],
    ['recurringAmount', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
    ['lastReset', getU64Decoder()],
  ]);
}

export function getTokenRecurringLimitCodec(): Codec<
  TokenRecurringLimit,
  TokenRecurringLimit
> {
  return combineCodec(
    getTokenRecurringLimitEncoder(),
    getTokenRecurringLimitDecoder(),
  );
}
