import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBooleanDecoder,
  getBooleanEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type SubAccount = {
  subAccount: ReadonlyUint8Array;
  bump: number;
  enabled: boolean;
  subAccountIndex: number;
  _padding: number;
  roleId: number;
  swigId: ReadonlyUint8Array;
};

export type SubAccountData = {
  subAccount: ReadonlyUint8Array;
  bump: number;
  enabled: boolean;
  subAccountIndex: number;
  _padding: number;
  roleId: number;
  swigId: ReadonlyUint8Array;
};

export function getSubAccountEncoder(): Encoder<SubAccountData> {
  return transformEncoder(
    getStructEncoder([
      ['subAccount', fixEncoderSize(getBytesEncoder(), 32)],
      ['bump', getU8Encoder()],
      ['enabled', getBooleanEncoder()],
      ['subAccountIndex', getU8Encoder()],
      ['_padding', getU8Encoder()],
      ['roleId', getU32Encoder()],
      ['swigId', fixEncoderSize(getBytesEncoder(), 32)],
    ]),
    (value) => ({
      ...value,
      _padding: 0,
    }),
  );
}

export function getSubAccountDecoder(): Decoder<SubAccountData> {
  return getStructDecoder([
    ['subAccount', fixDecoderSize(getBytesDecoder(), 32)],
    ['bump', getU8Decoder()],
    ['enabled', getBooleanDecoder()],
    ['subAccountIndex', getU8Decoder()],
    ['_padding', getU8Decoder()],
    ['roleId', getU32Decoder()],
    ['swigId', fixDecoderSize(getBytesDecoder(), 32)],
  ]);
}

export function getSubAccountCodec(): Codec<SubAccount, SubAccount> {
  return combineCodec(getSubAccountEncoder(), getSubAccountDecoder());
}
