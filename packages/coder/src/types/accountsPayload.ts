import {
  fixEncoderSize,
  getArrayEncoder,
  getBooleanEncoder,
  getBytesEncoder,
  getStructEncoder,
  transformEncoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type AccountPayload = {
  pubkey: ReadonlyUint8Array;
  isWritable: boolean;
  isSigner: boolean;
  _padding: ReadonlyUint8Array;
};

export type AccountMetaLike = {
  pubkey: ReadonlyUint8Array;
  isWritable: boolean;
  isSigner: boolean;
};

export function getAccountsPayloadEncoder(
  length: number,
): Encoder<AccountMetaLike[]> {
  return getArrayEncoder(getAccountPayloadEncoder(), { size: length });
}

export function getAccountPayloadEncoder(): Encoder<AccountMetaLike> {
  return transformEncoder(
    getStructEncoder([
      ['pubkey', fixEncoderSize(getBytesEncoder(), 32)],
      ['isWritable', getBooleanEncoder()],
      ['isSigner', getBooleanEncoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 6)],
    ]),
    (value) => ({
      ...value,
      _padding: new Uint8Array(6),
    }),
  );
}
