import {
  addDecoderSizePrefix,
  addEncoderSizePrefix,
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
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
  transformEncoder,
} from '@solana/codecs';
import {
  // addDecoderSizePrefix,
  // addEncoderSizePrefix,
  // combineCodec,
  // fixDecoderSize,
  // fixEncoderSize,
  // getBytesDecoder,
  // getBytesEncoder,
  // getStructDecoder,
  // getStructEncoder,
  // getU32Decoder,
  // getU32Encoder,
  // getU64Decoder,
  // getU64Encoder,
  // getU8Decoder,
  // getU8Encoder,
  // transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  AuthorityType,
  getAuthorityTypeDecoder,
  getAuthorityTypeEncoder,
} from '../types';
import { SwigInstructionDiscriminator as Discriminator } from './SwigInstruction';

export type CreateV1InstructionData = {
  discriminator: number;
  id: ReadonlyUint8Array;
  bump: number;
  initialAuthority: AuthorityType;
  startSlot: bigint;
  endSlot: bigint;
  authorityData: ReadonlyUint8Array;
};

export type CreateV1InstructionDataArgs = {
  id: ReadonlyUint8Array;
  bump: number;
  initialAuthority: AuthorityType;
  startSlot: bigint;
  endSlot: bigint;
  authorityData: ReadonlyUint8Array;
};

export function getCreateV1InstructionDataEncoder(): Encoder<CreateV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', getU8Encoder()],
      ['id', fixEncoderSize(getBytesEncoder(), 13)],
      ['bump', getU8Encoder()],
      ['initialAuthority', getAuthorityTypeEncoder()],
      ['startSlot', getU64Encoder()],
      ['endSlot', getU64Encoder()],
      [
        'authorityData',
        addEncoderSizePrefix(getBytesEncoder(), getU32Encoder()),
      ],
    ]),
    (value) => ({ ...value, discriminator: Discriminator.CreateV1 }),
  );
}

export function getCreateV1InstructionDataDecoder(): Decoder<CreateV1InstructionData> {
  return getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['id', fixDecoderSize(getBytesDecoder(), 13)],
    ['bump', getU8Decoder()],
    ['initialAuthority', getAuthorityTypeDecoder()],
    ['startSlot', getU64Decoder()],
    ['endSlot', getU64Decoder()],
    ['authorityData', addDecoderSizePrefix(getBytesDecoder(), getU32Decoder())],
  ]);
}

export function getCreateV1InstructionDataCodec(): Codec<
  CreateV1InstructionDataArgs,
  CreateV1InstructionData
> {
  return combineCodec(
    getCreateV1InstructionDataEncoder(),
    getCreateV1InstructionDataDecoder(),
  );
}
