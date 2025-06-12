import {
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getEnumDecoder,
  getEnumEncoder,
  getStructDecoder,
  getStructEncoder,
  getU128Decoder,
  getU128Encoder,
  getU64Decoder,
  getU64Encoder,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type ProgramScope = {
  currentAmount: bigint;
  limit: bigint;
  window: bigint;
  lastReset: bigint;
  programId: ReadonlyUint8Array;
  targetAccount: ReadonlyUint8Array;
  scopeType: ProgramScopeType;
  numericType: NumericType;
  balance_field_start: bigint;
  balance_field_end: bigint;
};

export function getProgramScopeEncoder(): Encoder<ProgramScope> {
  return getStructEncoder([
    ['currentAmount', getU128Encoder()],
    ['limit', getU128Encoder()],
    ['window', getU64Encoder()],
    ['lastReset', getU64Encoder()],
    ['programId', fixEncoderSize(getBytesEncoder(), 32)],
    ['targetAccount', fixEncoderSize(getBytesEncoder(), 32)],
    ['scopeType', getProgramScopeTypeEncoder()],
    ['numericType', getNumericTypeEncoder()],
    ['balance_field_start', getU64Encoder()],
    ['balance_field_end', getU64Encoder()],
  ]);
}

export function getProgramScopeDecoder(): Decoder<ProgramScope> {
  return getStructDecoder([
    ['currentAmount', getU128Decoder()],
    ['limit', getU128Decoder()],
    ['window', getU64Decoder()],
    ['lastReset', getU64Decoder()],
    ['programId', fixDecoderSize(getBytesDecoder(), 32)],
    ['targetAccount', fixDecoderSize(getBytesDecoder(), 32)],
    ['scopeType', getProgramScopeTypeDecoder()],
    ['numericType', getNumericTypeDecoder()],
    ['balance_field_start', getU64Decoder()],
    ['balance_field_end', getU64Decoder()],
  ]);
}

export enum ProgramScopeType {
  Basic,
  Limit,
  RecurringLimit,
}

export enum NumericType {
  U8,
  U32,
  U64,
  U128,
}

export function getProgramScopeTypeEncoder(): Encoder<ProgramScopeType> {
  return getEnumEncoder(ProgramScopeType, { size: getU64Encoder() });
}

export function getProgramScopeTypeDecoder(): Decoder<ProgramScopeType> {
  return getEnumDecoder(ProgramScopeType, { size: getU64Decoder() });
}

export function getNumericTypeEncoder(): Encoder<NumericType> {
  return getEnumEncoder(NumericType, { size: getU64Encoder() });
}

export function getNumericTypeDecoder(): Decoder<NumericType> {
  return getEnumDecoder(NumericType, { size: getU64Decoder() });
}
