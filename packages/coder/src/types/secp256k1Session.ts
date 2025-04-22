import {
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  transformEncoder,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type Secp256k1SessionAuthorityData = {
  publicKey: ReadonlyUint8Array;
  _padding: ReadonlyUint8Array;
  sigFilter: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};

export type Secp256k1SessionAuthorityDataArgs = {
  publicKey: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};

export type Secp256k1CreateSessionAuthorityData = {
  publicKey: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
  maxSessionLength: bigint;
};

export function getCreateSecp256k1SessionEncoder(): Encoder<Secp256k1CreateSessionAuthorityData> {
  return getStructEncoder([
    ['publicKey', fixEncoderSize(getBytesEncoder(), 64)],
    ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
    ['maxSessionLength', getU64Encoder()],
  ]);
}

export function getCreateSecp256k1SessionDecoder(): Decoder<Secp256k1CreateSessionAuthorityData> {
  return getStructDecoder([
    ['publicKey', fixDecoderSize(getBytesDecoder(), 64)],
    ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['maxSessionLength', getU64Decoder()],
  ]);
}

export function getSecp256k1SessionEncoder(): Encoder<Secp256k1SessionAuthorityDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['publicKey', fixEncoderSize(getBytesEncoder(), 33)],
      ['_padding', fixEncoderSize(getBytesEncoder(), 7)],
      ['sigFilter', fixEncoderSize(getBytesEncoder(), 152)],
      ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
      ['maxSessionLength', getU64Encoder()],
      ['currentSessionExpiration', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      sigFilter: Uint8Array.from(Array(152)),
      _padding: Uint8Array.from(Array(7)),
    }),
  );
}

export function getSecp256k1SessionDecoder(): Decoder<Secp256k1SessionAuthorityData> {
  return getStructDecoder([
    ['publicKey', fixDecoderSize(getBytesDecoder(), 33)],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
    ['sigFilter', fixDecoderSize(getBytesDecoder(), 152)],
    ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['maxSessionLength', getU64Decoder()],
    ['currentSessionExpiration', getU64Decoder()],
  ]);
}
