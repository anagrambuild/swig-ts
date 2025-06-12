import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type ProgramLimit = {
  programId: ReadonlyUint8Array;
};

export function getProgramLimitEncoder(): Encoder<ProgramLimit> {
  return getStructEncoder([
    ['programId', fixEncoderSize(getBytesEncoder(), 32)],
  ]);
}

export function getProgramLimitDecoder(): Decoder<ProgramLimit> {
  return getStructDecoder([
    ['programId', fixDecoderSize(getBytesDecoder(), 32)],
  ]);
}

export function getProgramLimitCodec(): Codec<ProgramLimit, ProgramLimit> {
  return combineCodec(getProgramLimitEncoder(), getProgramLimitDecoder());
}
