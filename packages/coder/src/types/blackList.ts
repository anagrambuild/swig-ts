import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getEnumDecoder,
  getEnumEncoder,
  getStructDecoder,
  getStructEncoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
  type Codec,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export enum BlackListEntityType {
  Program,
  Wallet,
}

export type BlackList = {
  entityId: ReadonlyUint8Array;
  entityType: BlackListEntityType;
  _paddding: ReadonlyUint8Array;
};

export type BlackListData = {
  entityId: ReadonlyUint8Array;
  entityType: BlackListEntityType;
};

export function getBlackListEntityTypeEncoder(): Encoder<BlackListEntityType> {
  return getEnumEncoder(BlackListEntityType, { size: getU8Encoder() });
}

export function getBlackListEntityTypeDecoder(): Decoder<BlackListEntityType> {
  return getEnumDecoder(BlackListEntityType, { size: getU8Decoder() });
}

export function getBlackListEncoder(): Encoder<BlackListData> {
  return transformEncoder(
    getStructEncoder([
      ['entityId', fixEncoderSize(getBytesEncoder(), 32)],
      ['entityType', getBlackListEntityTypeEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 7)],
    ]),
    (value) => ({
      ...value,
      _padding: new Uint8Array(7),
    }),
  );
}

export function getBlackListDecoder(): Decoder<BlackListData> {
  return getStructDecoder([
    ['entityId', fixDecoderSize(getBytesDecoder(), 32)],
    ['entityType', getBlackListEntityTypeDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
  ]);
}

export function getBlackListCodec(): Codec<BlackListData, BlackListData> {
  return combineCodec(getBlackListEncoder(), getBlackListDecoder());
}
