import {
  fixDecoderSize,
  getBytesDecoder,
  getStructDecoder,
  getU16Decoder,
  getU32Decoder,
  type Decoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { getAuthorityTypeDecoder, type AuthorityType } from '.';

export const POSITION_LENGTH = 16;

export type Position = {
  authorityType: AuthorityType;
  authorityLen: number;
  numActions: number;
  _padding: ReadonlyUint8Array;
  id: number;
  boundary: number;
};

export function getPositionDecoder(): Decoder<Position> {
  return getStructDecoder([
    ['authorityType', getAuthorityTypeDecoder()],
    ['authorityLen', getU16Decoder()],
    ['numActions', getU16Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 2)],
    ['id', getU32Decoder()],
    ['boundary', getU32Decoder()],
  ]);
}
