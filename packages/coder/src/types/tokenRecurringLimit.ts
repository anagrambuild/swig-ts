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
    ['recurringAmount', getU64Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
  ]);
}

export function getTokenRecurringLimitDecoder(): Decoder<TokenRecurringLimit> {
  return getStructDecoder([
    ['mint', fixDecoderSize(getBytesDecoder(), 32)],
    ['recurringAmount', getU64Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
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
