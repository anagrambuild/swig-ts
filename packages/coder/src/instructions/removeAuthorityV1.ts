import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getF32Decoder,
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

export type RemoveAuthorityV1InstructionData = {
  discriminator: number;
  authorityPayloadLen: number;
  _padding: ReadonlyUint8Array;
  actingRoleId: number;
  authorityToRemoveId: number;
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
  const encoder: Encoder<RemoveAuthorityV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['authorityPayloadLen', getU16Encoder()],
        ['_padding', fixEncoderSize(getBytesEncoder(), 4)],
        ['actingRoleId', getU32Encoder()],
        ['authorityToRemoveId', getU32Encoder()],
        ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.RemoveAuthorityV1,
        _padding: Uint8Array.from(Array(2)),
        authorityPayloadLen: payloadSize,
      }),
    );

  const decoder = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['authorityPayloadLen', getU16Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 4)],
    ['actingRoleId', getU32Decoder()],
    ['authorityToRemoveId', getF32Decoder()],
    ['authorityPayload', fixDecoderSize(getBytesDecoder(), payloadSize)],
  ]);

  const codec = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}

export type RemoveAuthorityV1AuthorityPayloadArgs = {
  actingRoleId: number;
  authorityToRemoveId: number;
};

export function getRemoveAuthorityV1AuthorityPayloadEncoder(
  payloadSize: number,
): Encoder<RemoveAuthorityV1AuthorityPayloadArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['authorityPayloadLen', getU16Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 4)],
      ['actingRoleId', getU32Encoder()],
      ['authorityToRemoveId', getU32Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.RemoveAuthorityV1,
      _padding: Uint8Array.from(Array(2)),
      authorityPayloadLen: payloadSize,
    }),
  );
}
