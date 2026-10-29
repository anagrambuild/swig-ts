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
  getU64Decoder,
  getU64Encoder,
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

/** Byte length of the fixed `AddAuthorizationLockV1` args, before the authority payload. */
export const ADD_AUTHORIZATION_LOCK_V1_ARGS_LENGTH = 88;

export type AddAuthorizationLockV1InstructionData = {
  discriminator: number;
  _padding: ReadonlyUint8Array;
  actingRoleId: number;
  /** Swig wallet address (native SOL) or a token account it owns. */
  assetAccount: ReadonlyUint8Array;
  /** Token mint, or 32 zero bytes for native SOL. */
  mint: ReadonlyUint8Array;
  amount: bigint;
  expirySlot: bigint;
  authorityPayload: ReadonlyUint8Array;
};

export type AddAuthorizationLockV1InstructionDataArgs = {
  actingRoleId: number;
  assetAccount: ReadonlyUint8Array;
  mint: ReadonlyUint8Array;
  amount: number | bigint;
  expirySlot: number | bigint;
  authorityPayload: ReadonlyUint8Array;
};

export function getAddAuthorizationLockV1InstructionDataCodec() {
  const encoder: Encoder<AddAuthorizationLockV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
        ['actingRoleId', getU32Encoder()],
        ['assetAccount', fixEncoderSize(getBytesEncoder(), 32)],
        ['mint', fixEncoderSize(getBytesEncoder(), 32)],
        ['amount', getU64Encoder()],
        ['expirySlot', getU64Encoder()],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.AddAuthorizationLockV1,
        _padding: new Uint8Array(2),
      }),
    );

  const payloadEncoder: Encoder<
    Omit<AddAuthorizationLockV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
      ['actingRoleId', getU32Encoder()],
      ['assetAccount', fixEncoderSize(getBytesEncoder(), 32)],
      ['mint', fixEncoderSize(getBytesEncoder(), 32)],
      ['amount', getU64Encoder()],
      ['expirySlot', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.AddAuthorizationLockV1,
      _padding: new Uint8Array(2),
    }),
  );

  const decoder: Decoder<AddAuthorizationLockV1InstructionData> =
    getStructDecoder([
      ['discriminator', getSwigInstructionDiscriminatorDecoder()],
      ['_padding', fixDecoderSize(getBytesDecoder(), 2)],
      ['actingRoleId', getU32Decoder()],
      ['assetAccount', fixDecoderSize(getBytesDecoder(), 32)],
      ['mint', fixDecoderSize(getBytesDecoder(), 32)],
      ['amount', getU64Decoder()],
      ['expirySlot', getU64Decoder()],
      ['authorityPayload', getBytesDecoder()],
    ]);

  const codec: Codec<
    AddAuthorizationLockV1InstructionDataArgs,
    AddAuthorizationLockV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
