import {
  addDecoderSizePrefix,
  addEncoderSizePrefix,
  combineCodec,
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getU64Encoder,
  transformEncoder,
} from '@solana/codecs';
import {
  // addDecoderSizePrefix,
  // addEncoderSizePrefix,
  // combineCodec,
  // getArrayDecoder,
  // getArrayEncoder,
  // getBytesDecoder,
  // getBytesEncoder,
  // getStructDecoder,
  // getStructEncoder,
  // getU32Decoder,
  // getU32Encoder,
  // getU64Decoder,
  // getU64Encoder,
  // transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getActionDecoder,
  getActionEncoder,
  getAuthorityTypeDecoder,
  getAuthorityTypeEncoder,
  type Action,
  type AuthorityType,
} from '.';

export type Role = {
  size: bigint;
  authorityType: AuthorityType;
  startSlot: bigint;
  endSlot: bigint;
  authorityData: ReadonlyUint8Array;
  actions: Array<Action>;
};

export type RoleParams = {
  size: bigint;
  authorityType: AuthorityType;
  startSlot: bigint;
  endSlot: bigint;
  authorityData: ReadonlyUint8Array;
  actions: Array<Action>;
};

export function getRoleEncoder(): Encoder<RoleParams> {
  let roleEncoder = getStructEncoder([
    ['size', getU64Encoder()],
    ['authorityType', getAuthorityTypeEncoder()],
    ['startSlot', getU64Encoder()],
    ['endSlot', getU64Encoder()],
    ['authorityData', addEncoderSizePrefix(getBytesEncoder(), getU32Encoder())],
    ['actions', getArrayEncoder(getActionEncoder())],
  ]);

  return transformEncoder(roleEncoder, (value) => ({
    ...value,
    size: roleEncoder.encode(value).length,
  }));
}

export function getRoleDecoder(): Decoder<Role> {
  return getStructDecoder([
    ['size', getU64Decoder()],
    ['authorityType', getAuthorityTypeDecoder()],
    ['startSlot', getU64Decoder()],
    ['endSlot', getU64Decoder()],
    ['authorityData', addDecoderSizePrefix(getBytesDecoder(), getU32Decoder())],
    ['actions', getArrayDecoder(getActionDecoder())],
  ]);
}

export function getRoleCodec(): Codec<Role, Role> {
  return combineCodec(getRoleEncoder(), getRoleDecoder());
}
