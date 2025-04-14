import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU8Decoder,
  getU8Encoder,
} from '@solana/codecs';
import {
  // combineCodec,
  // fixDecoderSize,
  // fixEncoderSize,
  // getArrayDecoder,
  // getArrayEncoder,
  // getBytesDecoder,
  // getBytesEncoder,
  // getStructDecoder,
  // getStructEncoder,
  // getU8Decoder,
  // getU8Encoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { getRoleDecoder, getRoleEncoder, type Role } from '../types';

export type SwigAccount = {
  discriminator: number;
  id: ReadonlyUint8Array;
  bump: number;
  roles: Array<Role>;
};

function getSwigEncoder(): Encoder<SwigAccount> {
  return getStructEncoder([
    ['discriminator', getU8Encoder()],
    ['id', fixEncoderSize(getBytesEncoder(), 13)],
    ['bump', getU8Encoder()],
    ['roles', getArrayEncoder(getRoleEncoder())],
  ]);
}

function getSwigDecoder(): Decoder<SwigAccount> {
  return getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['id', fixDecoderSize(getBytesDecoder(), 13)],
    ['bump', getU8Decoder()],
    ['roles', getArrayDecoder(getRoleDecoder())],
  ]);
}

export function getSwigCodec(): Codec<SwigAccount, SwigAccount> {
  return combineCodec(getSwigEncoder(), getSwigDecoder());
}
