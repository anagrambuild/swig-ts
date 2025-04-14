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
  getU16Decoder,
  getU16Encoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
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
  // getU16Decoder,
  // getU16Encoder,
  // getU8Decoder,
  // getU8Encoder,
  // transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getCompactInstructionDecoder,
  getCompactInstructionEncoder,
  type CompactInstruction,
} from '../types/compactInstruction';
import { SwigInstructionDiscriminator as Discriminator } from './SwigInstruction';

export type SignV1InstructionData = {
  discriminator: number;
  roleId: number;
  authorityPayloadLen: number;
  instructionPayloadLen: number;
  _padding: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
  compactInstructions: CompactInstruction[];
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
  let encoder: Encoder<SignV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getU8Encoder()],
      ['roleId', getU8Encoder()],
      ['authorityPayloadLen', getU16Encoder()],
      ['instructionPayloadLen', getU16Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
      ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
      [
        'compactInstructions',
        getArrayEncoder(getCompactInstructionEncoder(), {
          size: getU8Encoder(),
        }),
      ],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SignV1,
      _padding: Uint8Array.from(Array(2)),
      instructionPayloadLen: value.compactInstructions.length,
      authorityPayloadLen: payloadSize,
    }),
  );

  let decoder = getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['roleId', getU8Decoder()],
    ['authorityPayloadLen', getU16Decoder()],
    ['instructionPayloadLen', getU16Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 2)],
    ['authorityPayload', fixDecoderSize(getBytesDecoder(), payloadSize)],
    ['compactInstructions', getArrayDecoder(getCompactInstructionDecoder())],
  ]);

  let codec = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}
