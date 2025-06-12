// import {
//   combineCodec,
//   fixDecoderSize,
//   fixEncoderSize,
//   getArrayDecoder,
//   getArrayEncoder,
//   getBytesDecoder,
//   getBytesEncoder,
//   getStructDecoder,
//   getStructEncoder,
//   getU16Decoder,
//   getU16Encoder,
//   getU64Decoder,
//   getU64Encoder,
//   getU8Decoder,
//   getU8Encoder,
//   transformEncoder,
//   type Address,
//   type Codec,
//   type Decoder,
//   type Encoder,
//   type ReadonlyUint8Array,
// } from '@solana/kit';
// import {
//   AuthorityType,
//   getActionDecoder,
//   getActionEncoder,
//   getAuthorityTypeDecoder,
//   getAuthorityTypeEncoder,
//   type Action,
// } from '../types';
// import { SwigInstructionDiscriminator as Discriminator } from './SwigInstruction';

// export type ReplaceAuthorityV1InstructionData = {
//   discriminator: number;
//   actingRoleId: number;
//   authorityToReplaceId: number;
//   _padding1: ReadonlyUint8Array;
//   newAuthorityDataLen: number;
//   actionsPayloadLen: number;
//   newAuthorityType: AuthorityType;
//   _padding2: ReadonlyUint8Array;
//   startSlot: bigint;
//   endSlot: bigint;
//   newAuthorityData: ReadonlyUint8Array;
//   actions: Action[];
//   authorityPayload: ReadonlyUint8Array;
// };

// export type ReplaceAuthorityV1InstructionDataArgs = {
//   actingRoleId: number;
//   authorityToReplaceId: number;
//   newAuthorityType: AuthorityType;
//   startSlot: bigint;
//   endSlot: bigint;
//   newAuthorityData: ReadonlyUint8Array;
//   actions: Action[];
//   authorityPayload: ReadonlyUint8Array;
// };

// export function getReplaceAuthorityV1InstructionCodec(
//   payloadSize: number,
//   newAuthorityDataSize: number,
// ): {
//   encoder: Encoder<ReplaceAuthorityV1InstructionDataArgs>;
//   decoder: Decoder<ReplaceAuthorityV1InstructionData>;
//   codec: Codec<
//     ReplaceAuthorityV1InstructionDataArgs,
//     ReplaceAuthorityV1InstructionData
//   >;
// } {
//   let actionsEncoder = getArrayEncoder(getActionEncoder());

//   let encoder: Encoder<ReplaceAuthorityV1InstructionDataArgs> =
//     transformEncoder(
//       getStructEncoder([
//         ['discriminator', getU8Encoder()],
//         ['actingRoleId', getU8Encoder()],
//         ['authorityToReplaceId', getU8Encoder()],
//         ['_padding1', fixEncoderSize(getBytesEncoder(), 1)],
//         ['newAuthorityDataLen', getU16Encoder()],
//         ['actionsPayloadLen', getU16Encoder()],
//         ['newAuthorityType', getAuthorityTypeEncoder()],
//         ['_padding2', fixEncoderSize(getBytesEncoder(), 7)],
//         ['startSlot', getU64Encoder()],
//         ['endSlot', getU64Encoder()],
//         [
//           'newAuthorityData',
//           fixEncoderSize(getBytesEncoder(), newAuthorityDataSize),
//         ],
//         ['actions', actionsEncoder],
//         ['authorityPayload', fixEncoderSize(getBytesEncoder(), payloadSize)],
//       ]),
//       (value) => ({
//         ...value,
//         discriminator: Discriminator.ReplaceAuthorityV1,
//         _padding1: Uint8Array.from(Array(1)),
//         _padding2: Uint8Array.from(Array(7)),
//         actionsPayloadLen: actionsEncoder.encode(value.actions).length,
//         newAuthorityDataLen: newAuthorityDataSize,
//       }),
//     );

//   let decoder: Decoder<ReplaceAuthorityV1InstructionData> = getStructDecoder([
//     ['discriminator', getU8Decoder()],
//     ['actingRoleId', getU8Decoder()],
//     ['authorityToReplaceId', getU8Decoder()],
//     ['_padding1', fixDecoderSize(getBytesDecoder(), 1)],
//     ['newAuthorityDataLen', getU16Decoder()],
//     ['actionsPayloadLen', getU16Decoder()],
//     ['newAuthorityType', getAuthorityTypeDecoder()],
//     ['_padding2', fixDecoderSize(getBytesDecoder(), 7)],
//     ['startSlot', getU64Decoder()],
//     ['endSlot', getU64Decoder()],
//     [
//       'newAuthorityData',
//       fixDecoderSize(getBytesDecoder(), newAuthorityDataSize),
//     ],
//     ['actions', getArrayDecoder(getActionDecoder())],
//     ['authorityPayload', fixDecoderSize(getBytesDecoder(), payloadSize)],
//   ]);

//   let codec: Codec<
//     ReplaceAuthorityV1InstructionDataArgs,
//     ReplaceAuthorityV1InstructionData
//   > = combineCodec(encoder, decoder);

//   return { encoder, decoder, codec };
// }
