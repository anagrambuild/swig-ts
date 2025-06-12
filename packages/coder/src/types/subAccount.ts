import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type SubAccount = {
  subAccount: ReadonlyUint8Array;
};

export function getSubAccountEncoder(): Encoder<SubAccount> {
  return getStructEncoder([
    ['subAccount', fixEncoderSize(getBytesEncoder(), 32)],
  ]);
}

export function getSubAccountDecoder(): Decoder<SubAccount> {
  return getStructDecoder([
    ['subAccount', fixDecoderSize(getBytesDecoder(), 32)],
  ]);
}

export function getSubAccountCodec(): Codec<SubAccount, SubAccount> {
  return combineCodec(getSubAccountEncoder(), getSubAccountDecoder());
}
