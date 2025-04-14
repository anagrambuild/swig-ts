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
} from '@solana/codecs';
import {
  // combineCodec,
  // fixDecoderSize,
  // fixEncoderSize,
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
import { SwigInstructionDiscriminator as Discriminator } from './SwigInstruction';

export type RemoveAuthorityV1InstructionData = {
  discriminator: number;
  actingRoleId: number;
  authorityToRemoveId: number;
  _padding1: ReadonlyUint8Array;
  authorityPayloadLen: number;
  _padding2: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type RemoveAuthorityV1InstructionDataArgs = {
  actingRoleId: number;
  authorityToRemoveId: number;
  authorityPayload: ReadonlyUint8Array;
};

export function getRemoveAuthorityV1InstructionCodec(payloadSize: number): {
  encoder: Encoder<RemoveAuthorityV1InstructionDataArgs>;
  decoder: Decoder<RemoveAuthorityV1InstructionData>;
  codec: Codec<
    RemoveAuthorityV1InstructionDataArgs,
    RemoveAuthorityV1InstructionData
  >;
} {
  let encoder: Encoder<RemoveAuthorityV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getU8Encoder()],
      ['actingRoleId', getU8Encoder()],
      ['authorityToRemoveId', getU8Encoder()],
      ['_padding1', fixEncoderSize(getBytesEncoder(), 1)],
      ['authorityPayloadLen', getU16Encoder()],
      ['_padding2', fixEncoderSize(getBytesEncoder(), 2)],
      ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.RemoveAuthorityV1,
      _padding1: Uint8Array.from(Array(1)),
      _padding2: Uint8Array.from(Array(2)),
      authorityPayloadLen: payloadSize,
    }),
  );

  let decoder = getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['actingRoleId', getU8Decoder()],
    ['authorityToRemoveId', getU8Decoder()],
    ['_padding1', fixDecoderSize(getBytesDecoder(), 1)],
    ['authorityPayloadLen', getU16Decoder()],
    ['_padding2', fixDecoderSize(getBytesDecoder(), 2)],
    ['authorityPayload', fixDecoderSize(getBytesDecoder(), payloadSize)],
  ]);

  let codec = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}
