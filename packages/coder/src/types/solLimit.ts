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

export type SolLimit = {
  amount: bigint;
};

export function getSolLimitEncoder(): Encoder<SolLimit> {
  return getStructEncoder([['amount', getU64Encoder()]]);
}

export function getSolLimitDecoder(): Decoder<SolLimit> {
  return getStructDecoder([['amount', getU64Decoder()]]);
}

export function getSolLimitCodec(): Codec<SolLimit, SolLimit> {
  return combineCodec(getSolLimitEncoder(), getSolLimitDecoder());
}
