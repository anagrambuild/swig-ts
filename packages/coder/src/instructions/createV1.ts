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
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
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
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorDecoder,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type CreateV1InstructionData = {
  discriminator: number;
  authorityType: AuthorityType;
  authorityDataLen: number;
  noOfActions: number;
  bump: number;
  id: ReadonlyUint8Array;
  authorityData: ReadonlyUint8Array;
  actions: ReadonlyUint8Array;
};

export type CreateV1InstructionDataArgs = {
  authorityType: AuthorityType;
  authorityData: ReadonlyUint8Array;
  bump: number;
  /**
   * no of actions to add to the role
   */
  noOfActions: number;
  id: ReadonlyUint8Array;
  actions: ReadonlyUint8Array;
};

export function getCreateV1InstructionDataCodec() {
  const encoder: Encoder<CreateV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['authorityType', getAuthorityTypeEncoder()],
      ['authorityDataLen', getU16Encoder()],
      ['bump', getU8Encoder()],
      ['noOfActions', getU8Encoder()],
      ['id', fixEncoderSize(getBytesEncoder(), 32)],
      ['authorityData', getBytesEncoder()],
      ['actions', getBytesEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.CreateV1,
      authorityDataLen: value.authorityData.length,
    }),
  );

  const decoder: Decoder<CreateV1InstructionData> = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['authorityType', getAuthorityTypeDecoder()],
    ['authorityDataLen', getU16Decoder()],
    ['bump', getU8Decoder()],
    ['noOfActions', getU8Decoder()],
    ['id', fixDecoderSize(getBytesDecoder(), 32)],
    ['authorityData', getBytesDecoder()],
    ['actions', getBytesDecoder()],
  ]);

  const codec: Codec<CreateV1InstructionDataArgs, CreateV1InstructionData> =
    combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}
