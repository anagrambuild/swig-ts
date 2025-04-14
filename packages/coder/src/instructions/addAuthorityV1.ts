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
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
} from '@solana/codecs';
import {
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  AuthorityType,
  getActionDecoder,
  getActionEncoder,
  getAuthorityTypeDecoder,
  getAuthorityTypeEncoder,
  type Action,
} from '../types';
import { SwigInstructionDiscriminator as Discriminator } from './SwigInstruction';

export type AddAuthorityV1InstructionData = {
  discriminator: number;
  actingRoleId: number;
  newAuthorityDataLen: number;
  actionsPayloadLen: number;
  newAuthorityType: AuthorityType;
  _padding: ReadonlyUint8Array;
  startSlot: bigint;
  endSlot: bigint;
  newAuthorityData: ReadonlyUint8Array;
  actions: Action[];
  authorityPayload: ReadonlyUint8Array;
};

export type AddAuthorityV1InstructionDataArgs = {
  actingRoleId: number;
  newAuthorityType: AuthorityType;
  startSlot: bigint;
  endSlot: bigint;
  newAuthorityData: ReadonlyUint8Array;
  actions: Action[];
  authorityPayload: ReadonlyUint8Array;
};

export function getAddAuthorityV1InstructionCodec(
  payloadSize: number,
  newAuthorityDataSize: number,
): {
  encoder: Encoder<AddAuthorityV1InstructionDataArgs>;
  decoder: Decoder<AddAuthorityV1InstructionData>;
  codec: Codec<
    AddAuthorityV1InstructionDataArgs,
    AddAuthorityV1InstructionData
  >;
} {
  let actionsEncoder = getArrayEncoder(getActionEncoder());

  let encoder: Encoder<AddAuthorityV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getU8Encoder()],
      ['actingRoleId', getU8Encoder()],
      ['newAuthorityDataLen', getU16Encoder()],
      ['actionsPayloadLen', getU16Encoder()],
      ['newAuthorityType', getAuthorityTypeEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 1)],
      ['startSlot', getU64Encoder()],
      ['endSlot', getU64Encoder()],
      [
        'newAuthorityData',
        fixEncoderSize(getBytesEncoder(), newAuthorityDataSize),
      ],
      ['actions', actionsEncoder],
      ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.AddAuthorityV1,
      _padding: Uint8Array.from(Array(1)),
      actionsPayloadLen: actionsEncoder.encode(value.actions).length,
      newAuthorityDataLen: newAuthorityDataSize,
    }),
  );

  let decoder: Decoder<AddAuthorityV1InstructionData> = getStructDecoder([
    ['discriminator', getU8Decoder()],
    ['actingRoleId', getU8Decoder()],
    ['newAuthorityDataLen', getU16Decoder()],
    ['actionsPayloadLen', getU16Decoder()],
    ['newAuthorityType', getAuthorityTypeDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 1)],
    ['startSlot', getU64Decoder()],
    ['endSlot', getU64Decoder()],
    [
      'newAuthorityData',
      fixDecoderSize(getBytesDecoder(), newAuthorityDataSize),
    ],
    ['actions', getArrayDecoder(getActionDecoder())],
    ['authorityPayload', fixDecoderSize(getBytesDecoder(), payloadSize)],
  ]);

  let codec: Codec<
    AddAuthorityV1InstructionDataArgs,
    AddAuthorityV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec };
}
