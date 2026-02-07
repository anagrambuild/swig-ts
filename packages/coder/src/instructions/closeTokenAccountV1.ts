import {
  combineCodec,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU16Decoder,
  getU16Encoder,
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

export type CloseTokenAccountV1InstructionData = {
  discriminator: number;
  tokenAccountOffset: number;
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
};

export type CloseTokenAccountV1InstructionDataArgs = {
  tokenAccountOffset: number;
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
};

export function getCloseTokenAccountV1InstructionDataCodec() {
  const encoder: Encoder<CloseTokenAccountV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['tokenAccountOffset', getU16Encoder()],
        ['roleId', getU32Encoder()],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.CloseTokenAccountV1,
      }),
    );

  const payloadEncoder: Encoder<
    Omit<CloseTokenAccountV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['tokenAccountOffset', getU16Encoder()],
      ['roleId', getU32Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.CloseTokenAccountV1,
    }),
  );

  const decoder: Decoder<CloseTokenAccountV1InstructionData> = getStructDecoder(
    [
      ['discriminator', getSwigInstructionDiscriminatorDecoder()],
      ['tokenAccountOffset', getU16Decoder()],
      ['roleId', getU32Decoder()],
      ['authorityPayload', getBytesDecoder()],
    ],
  );

  const codec: Codec<
    CloseTokenAccountV1InstructionDataArgs,
    CloseTokenAccountV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
