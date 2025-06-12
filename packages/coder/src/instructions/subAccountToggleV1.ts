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

export type SubAccountToggleV1InstructionData = {
  discriminator: number;
  _padding: ReadonlyUint8Array;
  enabled: boolean;
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
};

export type SubAccountToggleV1InstructionDataArgs = {
  enabled: boolean;
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
};

export function getSubAccountToggleV1InstructionDataCodec() {
  const encoder: Encoder<SubAccountToggleV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['_padding', fixEncoderSize(getBytesEncoder(), 1)],
        ['enabled', getBooleanEncoder()],
        ['roleId', getU32Encoder()],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.SubAccountToggleV1,
        _padding: new Uint8Array(1),
      }),
    );

  const payloadEncoder: Encoder<
    Omit<SubAccountToggleV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 1)],
      ['enabled', getBooleanEncoder()],
      ['roleId', getU32Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SubAccountToggleV1,
      _padding: new Uint8Array(1),
    }),
  );

  const decoder: Decoder<SubAccountToggleV1InstructionData> = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 1)],
    ['enabled', getBooleanDecoder()],
    ['roleId', getU32Decoder()],
    ['authorityPayload', getBytesDecoder()],
  ]);

  const codec: Codec<
    SubAccountToggleV1InstructionDataArgs,
    SubAccountToggleV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
