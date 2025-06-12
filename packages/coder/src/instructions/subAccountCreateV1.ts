import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
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
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorDecoder,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type SubAccountCreateV1InstructionData = {
  discriminator: number;
  _padding1: ReadonlyUint8Array;
  roleId: number;
  bump: number;
  _padding2: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type SubAccountCreateV1InstructionDataArgs = {
  roleId: number;
  bump: number;
  authorityPayload: ReadonlyUint8Array;
};

export function getSubAccountCreateV1InstructionDataCodec() {
  const encoder: Encoder<SubAccountCreateV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['_padding1', fixEncoderSize(getBytesEncoder(), 2)],
        ['roleId', getU32Encoder()],
        ['bump', getU8Encoder()],
        ['_padding2', fixEncoderSize(getBytesEncoder(), 7)],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.SubAccountCreateV1,
        _padding1: new Uint8Array(2),
        _padding2: new Uint8Array(7),
      }),
    );

  const payloadEncoder: Encoder<
    Omit<SubAccountCreateV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding1', fixEncoderSize(getBytesEncoder(), 2)],
      ['roleId', getU32Encoder()],
      ['bump', getU8Encoder()],
      ['_padding2', fixEncoderSize(getBytesEncoder(), 7)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SubAccountCreateV1,
      _padding1: new Uint8Array(2),
      _padding2: new Uint8Array(7),
    }),
  );

  const decoder: Decoder<SubAccountCreateV1InstructionData> = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['_padding1', fixDecoderSize(getBytesDecoder(), 2)],
    ['roleId', getU32Decoder()],
    ['bump', getU8Decoder()],
    ['_padding2', fixDecoderSize(getBytesDecoder(), 7)],
    ['authorityPayload', getBytesDecoder()],
  ]);

  const codec: Codec<
    SubAccountCreateV1InstructionDataArgs,
    SubAccountCreateV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
