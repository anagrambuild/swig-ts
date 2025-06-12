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
} from '../types/compactInstruction';
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorDecoder,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type SignV1InstructionData = {
  discriminator: number;
  instructionPayloadLen: number;
  roleId: number;
  compactInstructions: CompactInstruction[];
  authorityPayload: ReadonlyUint8Array;
};

export type SignV1InstructionDataArgs = {
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
  compactInstructions: CompactInstruction[];
};

export function getSignV1InstructionCodec(payloadSize: number): {
  encoder: Encoder<SignV1InstructionDataArgs>;
  decoder: Decoder<SignV1InstructionData>;
  codec: Codec<SignV1InstructionDataArgs, SignV1InstructionData>;
} {
  const encoder: Encoder<SignV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['instructionPayloadLen', getU16Encoder()],
      ['roleId', getU32Encoder()],
      ['compactInstructions', getCompactInstructionsEncoder()],
      ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SignV1,
      instructionPayloadLen: getCompactInstructionsEncoder().encode(
        value.compactInstructions,
      ).length,
      authorityPayloadLen: payloadSize,
    }),
  );

  const decoder = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['instructionPayloadLen', getU16Decoder()],
    ['roleId', getU32Decoder()],
    ['compactInstructions', getCompactInstructionsDecoder()],
    ['authorityPayload', fixDecoderSize(getBytesDecoder(), payloadSize)],
  ]);

  const codec = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}
