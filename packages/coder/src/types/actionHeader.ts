import {
  combineCodec,
  getStructDecoder,
  getStructEncoder,
  getU16Decoder,
  getU16Encoder,
  getU32Decoder,
  getU32Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';
import { getPermissionDecoder, getPermissionEncoder, Permission } from '.';

export const ACTION_HEADER_LENGTH = 8;

export type ActionHeader = {
  permission: Permission;
  length: number;
  boundary: number;
};

export function getActionHeaderEncoder(): Encoder<ActionHeader> {
  return getStructEncoder([
    ['permission', getPermissionEncoder()],
    ['length', getU16Encoder()],
    ['boundary', getU32Encoder()],
  ]);
}

export function getActionHeaderDecoder(): Decoder<ActionHeader> {
  return getStructDecoder([
    ['permission', getPermissionDecoder()],
    ['length', getU16Decoder()],
    ['boundary', getU32Decoder()],
  ]);
}

export function getActionHeaderCodec(): Codec<ActionHeader, ActionHeader> {
  return combineCodec(getActionHeaderEncoder(), getActionHeaderDecoder());
}
