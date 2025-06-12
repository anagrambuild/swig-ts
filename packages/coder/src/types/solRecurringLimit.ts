import {
  combineCodec,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';

export type SolRecurringLimit = {
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
};

export function getSolRecurringLimitEncoder(): Encoder<SolRecurringLimit> {
  return getStructEncoder([
    ['recurringAmount', getU64Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
  ]);
}

export function getSolRecurringLimitDecoder(): Decoder<SolRecurringLimit> {
  return getStructDecoder([
    ['recurringAmount', getU64Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
  ]);
}

export function getSolRecurringLimitCodec(): Codec<
  SolRecurringLimit,
  SolRecurringLimit
> {
  return combineCodec(
    getSolRecurringLimitEncoder(),
    getSolRecurringLimitDecoder(),
  );
}
