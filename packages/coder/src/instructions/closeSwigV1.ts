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

export type CloseSwigV1InstructionData = {
  discriminator: number;
  _padding: ReadonlyUint8Array;
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
};

export type CloseSwigV1InstructionDataArgs = {
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
};

export function getCloseSwigV1InstructionDataCodec() {
  const encoder: Encoder<CloseSwigV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
      ['roleId', getU32Encoder()],
      ['authorityPayload', getBytesEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.CloseSwigV1,
      _padding: new Uint8Array(2),
    }),
  );

  const payloadEncoder: Encoder<
    Omit<CloseSwigV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
      ['roleId', getU32Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.CloseSwigV1,
      _padding: new Uint8Array(2),
    }),
  );

  const decoder: Decoder<CloseSwigV1InstructionData> = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 2)],
    ['roleId', getU32Decoder()],
    ['authorityPayload', getBytesDecoder()],
  ]);

  const codec: Codec<
    CloseSwigV1InstructionDataArgs,
    CloseSwigV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
