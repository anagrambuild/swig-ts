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

export type StakeRecurringLimit = {
  recurringAmount: bigint;
  window: bigint;
  lastReset: bigint;
  currentAmount: bigint;
};

export function getStakeRecurringLimitEncoder(): Encoder<StakeRecurringLimit> {
  return getStructEncoder([
    ['recurringAmount', getU64Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['currentAmount', getU64Encoder()],
  ]);
}

export function getStakeRecurringLimitDecoder(): Decoder<StakeRecurringLimit> {
  return getStructDecoder([
    ['recurringAmount', getU64Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['currentAmount', getU64Decoder()],
  ]);
}

export function getStakeRecurringLimitCodec(): Codec<
  StakeRecurringLimit,
  StakeRecurringLimit
> {
  return combineCodec(
    getStakeRecurringLimitEncoder(),
    getStakeRecurringLimitDecoder(),
  );
}
