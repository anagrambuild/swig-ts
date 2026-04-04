import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

/**
 * ProgramCurated permission type - allows signing for curated programs
 */
export type ProgramCurated = {
  _reserved?: ReadonlyUint8Array;
};

const PROGRAM_CURATED_RESERVED_BYTES = 32;

export function getProgramCuratedEncoder(): Encoder<ProgramCurated> {
  return transformEncoder(
    getStructEncoder([
      [
        '_reserved',
        fixEncoderSize(getBytesEncoder(), PROGRAM_CURATED_RESERVED_BYTES),
      ],
    ]),
    (value) => ({
      _reserved:
        value._reserved ?? new Uint8Array(PROGRAM_CURATED_RESERVED_BYTES),
    }),
  );
}

export function getProgramCuratedDecoder(): Decoder<ProgramCurated> {
  return getStructDecoder([
    [
      '_reserved',
      fixDecoderSize(getBytesDecoder(), PROGRAM_CURATED_RESERVED_BYTES),
    ],
  ]);
}

export function getProgramCuratedCodec(): Codec<
  ProgramCurated,
  ProgramCurated
> {
  return combineCodec(getProgramCuratedEncoder(), getProgramCuratedDecoder());
}
