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

export type SubAccountWithdrawV1InstructionData = {
  discriminator: number;
  _padding: ReadonlyUint8Array;
  roleId: number;
  amount: bigint;
  authorityPayload: ReadonlyUint8Array;
};

export type SubAccountWithdrawV1InstructionDataArgs = {
  roleId: number;
  amount: bigint;
  authorityPayload: ReadonlyUint8Array;
};

export function getSubAccountWithdrawV1InstructionDataCodec() {
  const encoder: Encoder<SubAccountWithdrawV1InstructionDataArgs> =
    transformEncoder(
      getStructEncoder([
        ['discriminator', getSwigInstructionDiscriminatorEncoder()],
        ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
        ['roleId', getU32Encoder()],
        ['amount', getU64Encoder()],
        ['authorityPayload', getBytesEncoder()],
      ]),
      (value) => ({
        ...value,
        discriminator: Discriminator.SubAccountWithdrawV1,
        _padding: new Uint8Array(2),
      }),
    );

  const payloadEncoder: Encoder<
    Omit<SubAccountWithdrawV1InstructionDataArgs, 'authorityPayload'>
  > = transformEncoder(
    getStructEncoder([
      ['discriminator', getSwigInstructionDiscriminatorEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 2)],
      ['roleId', getU32Encoder()],
      ['amount', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: Discriminator.SubAccountWithdrawV1,
      _padding: new Uint8Array(2),
    }),
  );

  const decoder: Decoder<SubAccountWithdrawV1InstructionData> =
    getStructDecoder([
      ['discriminator', getSwigInstructionDiscriminatorDecoder()],
      ['_padding', fixDecoderSize(getBytesDecoder(), 2)],
      ['roleId', getU32Decoder()],
      ['amount', getU64Decoder()],
      ['authorityPayload', getBytesDecoder()],
    ]);

  const codec: Codec<
    SubAccountWithdrawV1InstructionDataArgs,
    SubAccountWithdrawV1InstructionData
  > = combineCodec(encoder, decoder);

  return { encoder, decoder, codec, payloadEncoder };
}
