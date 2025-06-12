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
  getU64Decoder,
  getU64Encoder,
  transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { AuthorityType } from '../types';
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorDecoder,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type CreateSessionV1InstructionData = {
  discriminator: number;
  roleId: number;
  authorityPayloadLen: AuthorityType;
  sessionDuration: bigint;
  sessionKey: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type CreateSessionV1InstructionDataArgs = {
  roleId: number;
  sessionDuration: bigint;
  authorityPayload: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
};

export type CreateSessionV1InstructionAuthorityPayload = {
  discriminator: number;
  roleId: number;
  sessionDuration: bigint;
  authorityPayloadLen: number;
  sessionKey: ReadonlyUint8Array;
};

export type CreateSessionV1InstructionAuthorityPayloadArgs = {
  roleId: number;
  sessionDuration: bigint;
  sessionKey: ReadonlyUint8Array;
};

export function getCreateSessionV1AuthorityPayloadCodec(payloadSize: number): {
  encoder: Encoder<CreateSessionV1InstructionAuthorityPayloadArgs>;
  decoder: Decoder<CreateSessionV1InstructionAuthorityPayload>;
  codec: Codec<
    CreateSessionV1InstructionAuthorityPayloadArgs,
    CreateSessionV1InstructionAuthorityPayload
  >;
} {
  const encoder: Encoder<CreateSessionV1InstructionAuthorityPayloadArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['authorityPayloadLen', getU16Encoder()],
        ['roleId', getU32Encoder()],
        ['sessionDuration', getU64Encoder()],
        ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.CreateSessionV1,
        authorityPayloadLen: payloadSize,
      }),
    );

  const decoder: Decoder<CreateSessionV1InstructionAuthorityPayload> =
    getStructDecoder([
      ['discriminator', getSwigInstructionDiscriminatorDecoder()],
      ['roleId', getU32Decoder()],
      ['authorityPayloadLen', getU16Decoder()],
      ['sessionDuration', getU64Decoder()],
      ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ]);

  const codec: Codec<
    CreateSessionV1InstructionAuthorityPayloadArgs,
    CreateSessionV1InstructionAuthorityPayload
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}

export function getCreateSessionV1InstructionCodec(payloadSize: number): {
  encoder: Encoder<CreateSessionV1InstructionDataArgs>;
  decoder: Decoder<CreateSessionV1InstructionData>;
  codec: Codec<
    CreateSessionV1InstructionDataArgs,
    CreateSessionV1InstructionData
  >;
} {
  const encoder: Encoder<CreateSessionV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['authorityPayloadLen', getU16Encoder()],
      ['roleId', getU32Encoder()],
      ['sessionDuration', getU64Encoder()],
      ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
      ['authorityPayload', getBytesEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.CreateSessionV1,
      authorityPayloadLen: payloadSize,
    }),
  );

  const decoder: Decoder<CreateSessionV1InstructionData> = getStructDecoder([
    ['discriminator', getSwigInstructionDiscriminatorDecoder()],
    ['roleId', getU32Decoder()],
    ['authorityPayloadLen', getU16Decoder()],
    ['sessionDuration', getU64Decoder()],
    ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['authorityPayload', getBytesDecoder()],
  ]);

  const codec: Codec<
    CreateSessionV1InstructionDataArgs,
    CreateSessionV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}
