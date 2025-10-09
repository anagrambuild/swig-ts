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

export enum BlacklistEntityKind {
  Program,
  Wallet,
}

export type Blacklist = {
  entityId: ReadonlyUint8Array;
  entityKind: BlacklistEntityKind;
  _paddding: ReadonlyUint8Array;
};

export type BlacklistData = {
  entityId: ReadonlyUint8Array;
  entityKind: BlacklistEntityKind;
};

export function getBlacklistEntityTypeEncoder(): Encoder<BlacklistEntityKind> {
  return getEnumEncoder(BlacklistEntityKind, { size: getU8Encoder() });
}

export function getBlacklistEntityTypeDecoder(): Decoder<BlacklistEntityKind> {
  return getEnumDecoder(BlacklistEntityKind, { size: getU8Decoder() });
}

export function getBlacklistEncoder(): Encoder<BlacklistData> {
  return transformEncoder(
    getStructEncoder([
      ['entityId', fixEncoderSize(getBytesEncoder(), 32)],
      ['entityKind', getBlacklistEntityTypeEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 7)],
    ]),
    (value) => ({
      ...value,
      _padding: new Uint8Array(7),
    }),
  );
}

export function getBlacklistDecoder(): Decoder<BlacklistData> {
  return getStructDecoder([
    ['entityId', fixDecoderSize(getBytesDecoder(), 32)],
    ['entityKind', getBlacklistEntityTypeDecoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
  ]);
}

export function getBlacklistCodec(): Codec<BlacklistData, BlacklistData> {
  return combineCodec(getBlacklistEncoder(), getBlacklistDecoder());
}

export type BlacklistEntity = 'program' | 'wallet';

export function toBlacklistEntityKind(
  entity: BlacklistEntity,
): BlacklistEntityKind {
  if (entity === 'program') {
    return BlacklistEntityKind.Program;
  }
  return BlacklistEntityKind.Wallet;
}
