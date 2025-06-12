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
  transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getCompactInstructionsDecoder,
  getCompactInstructionsEncoder,
  type CompactInstruction,
} from '../types';
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorDecoder,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type SubAccountSignV1InstructionData = {
  discriminator: number;
  instructionPayloadLen: number;
  roleId: number;
  _padding: ReadonlyUint8Array;
  compactInstructions: CompactInstruction[];
  authorityPayload: ReadonlyUint8Array;
};

export type SubAccountSignV1InstructionDataArgs = {
  roleId: number;
  compactInstructions: CompactInstruction[];
  authorityPayload: ReadonlyUint8Array;
};

export function getSubAccountSignV1InstructionDataCodec() {
  const encoder: Encoder<SubAccountSignV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['instructionPayloadLen', getU16Encoder()],
        ['roleId', getU32Encoder()],
        ['_padding', fixEncoderSize(getBytesEncoder(), 8)],
        ['compactInstructions', getCompactInstructionsEncoder()],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.SubAccountSignV1,
        instructionPayloadLen: getCompactInstructionsEncoder().encode(
          value.compactInstructions,
        ).length,
        _padding: new Uint8Array(8),
      }),
    );

  const payloadEncoder: Encoder<
    Omit<SubAccountSignV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['instructionPayloadLen', getU16Encoder()],
      ['roleId', getU32Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 8)],
      ['compactInstructions', getCompactInstructionsEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SubAccountSignV1,
      instructionPayloadLen: getCompactInstructionsEncoder().encode(
        value.compactInstructions,
      ).length,
      _padding: new Uint8Array(8),
    }),
  );

  const decoder: Decoder<SubAccountSignV1InstructionData> = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['instructionPayloadLen', getU16Decoder()],
    ['roleId', getU32Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 8)],
    ['compactInstructions', getCompactInstructionsDecoder()],
    ['authorityPayload', getBytesDecoder()],
  ]);

  const codec: Codec<
    SubAccountSignV1InstructionDataArgs,
    SubAccountSignV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
