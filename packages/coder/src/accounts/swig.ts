import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU16Decoder,
  getU16Encoder,
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

export type SwigAccount = {
  discriminator: number;
  bump: number;
  id: ReadonlyUint8Array;
  roles: number;
  role_counter: number;
  reserved_lamports: bigint;
  roles_buffer: ReadonlyUint8Array;
};

function getSwigEncoder(): Encoder<SwigAccount> {
  return getStructEncoder([
    ['discriminator', getU8Encoder()],
    ['bump', getU8Encoder()],
    ['id', fixEncoderSize(getBytesEncoder(), 32)],
    ['roles', getU16Encoder()],
    ['role_counter', getU32Encoder()],
    ['reserved_lamports', getU64Encoder()],
    ['roles_buffer', getBytesEncoder()],
  ]);
}

function getSwigDecoder(): Decoder<SwigAccount> {
  return getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['bump', getU8Decoder()],
    ['id', fixDecoderSize(getBytesDecoder(), 32)],
    ['roles', getU16Decoder()],
    ['role_counter', getU32Decoder()],
    ['reserved_lamports', getU64Decoder()],
    ['roles_buffer', getBytesDecoder()],
  ]);
}

export function getSwigCodec(): Codec<SwigAccount, SwigAccount> {
  return combineCodec(getSwigEncoder(), getSwigDecoder());
}
