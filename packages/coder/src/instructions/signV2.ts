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

export type SignV2InstructionData = {
  discriminator: number;
  instructionPayloadLen: number;
  roleId: number;
  compactInstructions: CompactInstruction[];
  authorityPayload: ReadonlyUint8Array;
};

export type SignV2InstructionDataArgs = {
  roleId: number;
  authorityPayload: ReadonlyUint8Array;
  compactInstructions: CompactInstruction[];
};

export function getSignV2InstructionCodec(payloadSize: number): {
  encoder: Encoder<SignV2InstructionDataArgs>;
  decoder: Decoder<SignV2InstructionData>;
  codec: Codec<SignV2InstructionDataArgs, SignV2InstructionData>;
} {
  const encoder: Encoder<SignV2InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['instructionPayloadLen', getU16Encoder()],
      ['roleId', getU32Encoder()],
      ['compactInstructions', getCompactInstructionsEncoder()],
      ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SignV2,
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
