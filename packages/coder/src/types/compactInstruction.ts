import {
  addEncoderSizePrefix,
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU16Encoder,
  getU8Decoder,
  getU8Encoder,
} from '@solana/codecs';
import {
  // addEncoderSizePrefix,
  // getArrayDecoder,
  // getArrayEncoder,
  // getBytesDecoder,
  // getBytesEncoder,
  // getStructDecoder,
  // getStructEncoder,
  // getU16Encoder,
  // getU8Decoder,
  // getU8Encoder,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
export type CompactInstruction = {
  programIdIndex: number;
  accounts: number[];
  data: ReadonlyUint8Array;
};

export function getCompactInstructionDecoder(): Decoder<CompactInstruction> {
  return getStructDecoder([
    ['programIdIndex', getU8Decoder()],
    ['accounts', getArrayDecoder(getU8Decoder())],
    ['data', getBytesDecoder()],
  ]);
}

export function getCompactInstructionEncoder(): Encoder<CompactInstruction> {
  return getStructEncoder([
    ['programIdIndex', getU8Encoder()],
    ['accounts', getArrayEncoder(getU8Encoder(), { size: getU8Encoder() })],
    ['data', addEncoderSizePrefix(getBytesEncoder(), getU16Encoder())],
  ]);
}
