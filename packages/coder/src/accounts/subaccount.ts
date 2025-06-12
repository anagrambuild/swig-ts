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
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getSwigAccountDiscriminatorDecoder,
  getSwigAccountDiscriminatorEncoder,
  type SwigAccountDiscriminator,
} from './discriminator';

export type SwigSubAccount = {
  discriminator: SwigAccountDiscriminator;
  bump: number;
  enabled: boolean;
  _padding: ReadonlyUint8Array;
  roleId: number;
  swigId: ReadonlyUint8Array;
  reservedLamports: bigint;
};

function getSwigSubAccountEncoder(): Encoder<SwigSubAccount> {
  return getStructEncoder([
    ['discriminator', getSwigAccountDiscriminatorEncoder()],
    ['bump', getU8Encoder()],
    ['enabled', getBooleanEncoder()],
    ['_padding', fixEncoderSize(getBytesEncoder(), 1)],
    ['roleId', getU32Encoder()],
    ['swigId', fixEncoderSize(getBytesEncoder(), 32)],
    ['reservedLamports', getU64Encoder()],
  ]);
}

function getSwigSubAccountDecoder(): Decoder<SwigSubAccount> {
  return getStructDecoder([
    ['discriminator', getSwigAccountDiscriminatorDecoder()],
    ['bump', getU8Decoder()],
    ['enabled', getBooleanDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 1)],
    ['roleId', getU32Decoder()],
    ['swigId', fixDecoderSize(getBytesDecoder(), 32)],
    ['reservedLamports', getU64Decoder()],
  ]);
}

export function getSwigSubAccountCodec(): Codec<
  SwigSubAccount,
  SwigSubAccount
> {
  return combineCodec(getSwigSubAccountEncoder(), getSwigSubAccountDecoder());
}
