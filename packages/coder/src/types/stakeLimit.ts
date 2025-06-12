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

export type StakeLimit = {
  amount: bigint;
};

export function getStakeLimitEncoder(): Encoder<StakeLimit> {
  return getStructEncoder([['amount', getU64Encoder()]]);
}

export function getStakeLimitDecoder(): Decoder<StakeLimit> {
  return getStructDecoder([['amount', getU64Decoder()]]);
}

export function getStakeLimitCodec(): Codec<StakeLimit, StakeLimit> {
  return combineCodec(getStakeLimitEncoder(), getStakeLimitDecoder());
}
