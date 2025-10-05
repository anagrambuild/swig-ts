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
import {
  SwigInstructionDiscriminator as Discriminator,
  getSwigInstructionDiscriminatorEncoder,
} from './SwigInstruction';

export type UpdateAuthorityV1InstructionData = {
  discriminator: number;
  updateActionsPayloadLen: number;
  numActions: number;
  _padding: ReadonlyUint8Array;
  actingRoleId: number;
  authorityToUpdateId: number;
  updateActionsPayload: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type UpdateAuthorityV1InstructionDataArgs = {
  actingRoleId: number;
  authorityToUpdateId: number;
  updateActionsPayload: ReadonlyUint8Array;
  authorityPayload: ReadonlyUint8Array;
};

export type UpdateAuthorityV1InstructionDecodeDataArgs = {
  discriminator: number;
  updateActionsPayloadLen: number;
  numActions: number;
  _padding: ReadonlyUint8Array;
  actingRoleId: number;
  authorityToUpdateId: number;
  payload: ReadonlyUint8Array;
};

export function getUpdateAuthorityV1InstructionCodec(): {
  encoder: Encoder<UpdateAuthorityV1InstructionDataArgs>;
} {
  let encoder: Encoder<UpdateAuthorityV1InstructionDataArgs> = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['updateActionsPayloadLen', getU16Encoder()],
      ['numActions', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 3)],
      ['actingRoleId', getU32Encoder()],
      ['authorityToUpdateId', getU32Encoder()],
      ['updateActionsPayload', getBytesEncoder()],
      ['authorityPayload', getBytesEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.UpdateAuthorityV1,
      _padding: Uint8Array.from(Array(3)),
      updateActionsPayloadLen: value.updateActionsPayload.length,
      numActions: 0,
    }),
  );

  return { encoder };
}
