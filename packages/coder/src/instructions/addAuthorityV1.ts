import {
  fixEncoderSize,
  getBytesEncoder,
  getStructEncoder,
  getU16Encoder,
  getU32Encoder,
  getU8Encoder,
  transformEncoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { AuthorityType, getAuthorityTypeEncoder } from '../types';
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type AddAuthorityV1InstructionData = {
  discriminator: number;
  newAuthorityDataLen: number;
  actionsPayloadLen: number;
  newAuthorityType: AuthorityType;
  noOfActions: number;
  _padding: ReadonlyUint8Array; // 3
  actingRoleId: number;
  newAuthorityData: ReadonlyUint8Array;
  actions: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type AddAuthorityV1InstructionDataArgs = {
  actingRoleId: number;
  newAuthorityType: AuthorityType;
  noOfActions: number;
  newAuthorityData: ReadonlyUint8Array;
  actions: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export function getAddAuthorityV1InstructionCodec(
  payloadSize: number,
  newAuthorityDataSize: number,
): Encoder<AddAuthorityV1InstructionDataArgs> {
  const encoder: Encoder<AddAuthorityV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['newAuthorityDataLen', getU16Encoder()],
      ['actionsPayloadLen', getU16Encoder()],
      ['newAuthorityType', getAuthorityTypeEncoder()],
      ['noOfActions', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 3)],
      ['actingRoleId', getU32Encoder()],
      [
        'newAuthorityData',
        fixEncoderSize(getBytesEncoder(), newAuthorityDataSize),
      ],
      ['actions', getBytesEncoder()],
      ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.AddAuthorityV1,
      actionsPayloadLen: value.actions.length,
      newAuthorityDataLen: newAuthorityDataSize,
      _padding: Uint8Array.from(Array(3)),
    }),
  );

  return encoder;
}

export type AddAuthorityV1AuthorityPayload = {
  discriminator: number;
  newAuthorityDataLen: number;
  actionsPayloadLen: number;
  newAuthorityType: AuthorityType;
  noOfActions: number;
  _padding: ReadonlyUint8Array; // 3
  actingRoleId: number;
  newAuthorityData: ReadonlyUint8Array;
  actions: ReadonlyUint8Array;
};

export type AddAuthorityV1AuthorityPayloadArgs = {
  newAuthorityType: AuthorityType;
  noOfActions: number;
  actingRoleId: number;
  newAuthorityData: ReadonlyUint8Array;
  actions: ReadonlyUint8Array;
};

export function getAddAuthorityV1AuthorityPayloadEncoder(): Encoder<AddAuthorityV1AuthorityPayloadArgs> {
  const encoder: Encoder<AddAuthorityV1AuthorityPayloadArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['newAuthorityDataLen', getU16Encoder()],
      ['actionsPayloadLen', getU16Encoder()],
      ['newAuthorityType', getAuthorityTypeEncoder()],
      ['noOfActions', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 3)],
      ['actingRoleId', getU32Encoder()],
      ['newAuthorityData', getBytesEncoder()],
      ['actions', getBytesEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.AddAuthorityV1,
      actionsPayloadLen: value.actions.length,
      newAuthorityDataLen: value.newAuthorityData.length,
      _padding: Uint8Array.from(Array(3)),
    }),
  );

  return encoder;
}
