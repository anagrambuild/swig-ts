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

export type TokenLimit = {
  mint: ReadonlyUint8Array;
  amount: bigint;
};

export function getTokenLimitEncoder(): Encoder<TokenLimit> {
  return getStructEncoder([
    ['mint', fixEncoderSize(getBytesEncoder(), 32)],
    ['amount', getU64Encoder()],
  ]);
}

export function getTokenLimitDecoder(): Decoder<TokenLimit> {
  return getStructDecoder([
    ['mint', fixDecoderSize(getBytesDecoder(), 32)],
    ['amount', getU64Decoder()],
  ]);
}

export function getTokenLimitCodec(): Codec<TokenLimit, TokenLimit> {
  return combineCodec(getTokenLimitEncoder(), getTokenLimitDecoder());
}
