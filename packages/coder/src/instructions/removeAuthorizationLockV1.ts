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

/** Byte length of the fixed `RemoveAuthorizationLockV1` args, before the authority payload. */
export const REMOVE_AUTHORIZATION_LOCK_V1_ARGS_LENGTH = 16;

export type RemoveAuthorizationLockV1InstructionData = {
  discriminator: number;
  _padding: ReadonlyUint8Array;
  actingRoleId: number;
  lockId: number;
  _reserved: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type RemoveAuthorizationLockV1InstructionDataArgs = {
  actingRoleId: number;
  lockId: number;
  authorityPayload: ReadonlyUint8Array;
};

export function getRemoveAuthorizationLockV1InstructionDataCodec() {
  const encoder: Encoder<RemoveAuthorizationLockV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
        ['actingRoleId', getU32Encoder()],
        ['lockId', getU32Encoder()],
        ['_reserved', fixEncoderSize(getBytesEncoder(), 4)],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.RemoveAuthorizationLockV1,
        _padding: new Uint8Array(2),
        _reserved: new Uint8Array(4),
      }),
    );

  const payloadEncoder: Encoder<
    Omit<RemoveAuthorizationLockV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
      ['actingRoleId', getU32Encoder()],
      ['lockId', getU32Encoder()],
      ['_reserved', fixEncoderSize(getBytesEncoder(), 4)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.RemoveAuthorizationLockV1,
      _padding: new Uint8Array(2),
      _reserved: new Uint8Array(4),
    }),
  );

  const decoder: Decoder<RemoveAuthorizationLockV1InstructionData> =
    getStructDecoder([
      ['discriminator', getSwigInstructionDiscriminatorDecoder()],
      ['_padding', fixDecoderSize(getBytesDecoder(), 2)],
      ['actingRoleId', getU32Decoder()],
      ['lockId', getU32Decoder()],
      ['_reserved', fixDecoderSize(getBytesDecoder(), 4)],
      ['authorityPayload', getBytesDecoder()],
    ]);

  const codec: Codec<
    RemoveAuthorizationLockV1InstructionDataArgs,
    RemoveAuthorizationLockV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
