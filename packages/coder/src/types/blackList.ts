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

export enum BlackListEntityKind {
  Program,
  Wallet,
}

export type BlackList = {
  entityId: ReadonlyUint8Array;
  entityKind: BlackListEntityKind;
  _paddding: ReadonlyUint8Array;
};

export type BlackListData = {
  entityId: ReadonlyUint8Array;
  entityKind: BlackListEntityKind;
};

export function getBlackListEntityTypeEncoder(): Encoder<BlackListEntityKind> {
  return getEnumEncoder(BlackListEntityKind, { size: getU8Encoder() });
}

export function getBlackListEntityTypeDecoder(): Decoder<BlackListEntityKind> {
  return getEnumDecoder(BlackListEntityKind, { size: getU8Decoder() });
}

export function getBlackListEncoder(): Encoder<BlackListData> {
  return transformEncoder(
    getStructEncoder([
      ['entityId', fixEncoderSize(getBytesEncoder(), 32)],
      ['entityKind', getBlackListEntityTypeEncoder()],
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
    ['entityKind', getBlackListEntityTypeDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
  ]);
}

export function getBlackListCodec(): Codec<BlackListData, BlackListData> {
  return combineCodec(getBlackListEncoder(), getBlackListDecoder());
}

export type BlackListEntity = 'program' | 'wallet';

export function toBlackListEntityKind(
  entity: BlackListEntity,
): BlackListEntityKind {
  if (entity === 'program') {
    return BlackListEntityKind.Program;
  }
  return BlackListEntityKind.Wallet;
}
