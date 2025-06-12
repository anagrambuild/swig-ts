import {
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type Ed25519SessionAuthorityData = {
  publicKey: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};

export function getEd25519SessionEncoder(): Encoder<Ed25519SessionAuthorityData> {
  return getStructEncoder([
    ['publicKey', fixEncoderSize(getBytesEncoder(), 32)],
    ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
    ['maxSessionLength', getU64Encoder()],
    ['currentSessionExpiration', getU64Encoder()],
  ]);
}

export function getEd25519SessionDecoder(): Decoder<Ed25519SessionAuthorityData> {
  return getStructDecoder([
    ['publicKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['maxSessionLength', getU64Decoder()],
    ['currentSessionExpiration', getU64Decoder()],
  ]);
}
