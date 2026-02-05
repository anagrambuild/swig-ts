import {
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

const MAX_INSTRUCTION_PREFIX_LEN = 40;
const PROGRAM_EXEC_AUTHORITY_LEN = 80;
const PROGRAM_EXEC_SESSION_AUTHORITY_LEN = 128;

/**
 * ProgramExec authority data structure (80 bytes).
 *
 * Validates that a preceding instruction matches the configured
 * program and instruction prefix.
 */
export type ProgramExecAuthorityData = {
  /** The program ID that must execute the preceding instruction (32 bytes) */
  programId: ReadonlyUint8Array;
  /** Length of the instruction prefix to match (0-40) */
  instructionPrefixLen: number;
  /** Padding for alignment (7 bytes) */
  _padding: ReadonlyUint8Array;
  /** The instruction data prefix that must match (40 bytes) */
  instructionPrefix: ReadonlyUint8Array;
};

export type ProgramExecAuthorityDataArgs = {
  programId: ReadonlyUint8Array;
  instructionPrefixLen: number;
  instructionPrefix: ReadonlyUint8Array;
};

/**
 * ProgramExecSession authority data structure (128 bytes).
 *
 * Combines program execution validation with time-limited sessions.
 */
export type ProgramExecSessionAuthorityData = {
  /** The program ID that must execute the preceding instruction (32 bytes) */
  programId: ReadonlyUint8Array;
  /** Length of the instruction prefix to match (0-40) */
  instructionPrefixLen: number;
  /** Padding for alignment (7 bytes) */
  _padding: ReadonlyUint8Array;
  /** The instruction data prefix that must match (40 bytes) */
  instructionPrefix: ReadonlyUint8Array;
  /** The current session key (32 bytes) */
  sessionKey: ReadonlyUint8Array;
  /** Maximum allowed session duration */
  maxSessionLength: bigint;
  /** Slot when the current session expires */
  currentSessionExpiration: bigint;
};

export type ProgramExecSessionAuthorityDataArgs = {
  programId: ReadonlyUint8Array;
  instructionPrefixLen: number;
  instructionPrefix: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};

/**
 * Data for creating a ProgramExecSession authority (120 bytes).
 * Does not include currentSessionExpiration as it's set to 0 on creation.
 */
export type CreateProgramExecSessionAuthorityData = {
  programId: ReadonlyUint8Array;
  instructionPrefixLen: number;
  instructionPrefix: ReadonlyUint8Array;
  sessionKey: ReadonlyUint8Array;
  maxSessionLength: bigint;
};

// ProgramExec encoders/decoders

export function getProgramExecEncoder(): Encoder<ProgramExecAuthorityDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['programId', fixEncoderSize(getBytesEncoder(), 32)],
      ['instructionPrefixLen', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 7)],
      [
        'instructionPrefix',
        fixEncoderSize(getBytesEncoder(), MAX_INSTRUCTION_PREFIX_LEN),
      ],
    ]),
    (value) => ({
      ...value,
      _padding: Uint8Array.from(Array(7)),
    }),
  );
}

export function getProgramExecDecoder(): Decoder<ProgramExecAuthorityData> {
  return getStructDecoder([
    ['programId', fixDecoderSize(getBytesDecoder(), 32)],
    ['instructionPrefixLen', getU8Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
    [
      'instructionPrefix',
      fixDecoderSize(getBytesDecoder(), MAX_INSTRUCTION_PREFIX_LEN),
    ],
  ]);
}

// ProgramExecSession encoders/decoders

export function getCreateProgramExecSessionEncoder(): Encoder<CreateProgramExecSessionAuthorityData> {
  return transformEncoder(
    getStructEncoder([
      ['programId', fixEncoderSize(getBytesEncoder(), 32)],
      ['instructionPrefixLen', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 7)],
      [
        'instructionPrefix',
        fixEncoderSize(getBytesEncoder(), MAX_INSTRUCTION_PREFIX_LEN),
      ],
      ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
      ['maxSessionLength', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      _padding: Uint8Array.from(Array(7)),
    }),
  );
}

export function getCreateProgramExecSessionDecoder(): Decoder<CreateProgramExecSessionAuthorityData> {
  return getStructDecoder([
    ['programId', fixDecoderSize(getBytesDecoder(), 32)],
    ['instructionPrefixLen', getU8Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
    [
      'instructionPrefix',
      fixDecoderSize(getBytesDecoder(), MAX_INSTRUCTION_PREFIX_LEN),
    ],
    ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['maxSessionLength', getU64Decoder()],
  ]);
}

export function getProgramExecSessionEncoder(): Encoder<ProgramExecSessionAuthorityDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['programId', fixEncoderSize(getBytesEncoder(), 32)],
      ['instructionPrefixLen', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 7)],
      [
        'instructionPrefix',
        fixEncoderSize(getBytesEncoder(), MAX_INSTRUCTION_PREFIX_LEN),
      ],
      ['sessionKey', fixEncoderSize(getBytesEncoder(), 32)],
      ['maxSessionLength', getU64Encoder()],
      ['currentSessionExpiration', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      _padding: Uint8Array.from(Array(7)),
    }),
  );
}

export function getProgramExecSessionDecoder(): Decoder<ProgramExecSessionAuthorityData> {
  return getStructDecoder([
    ['programId', fixDecoderSize(getBytesDecoder(), 32)],
    ['instructionPrefixLen', getU8Decoder()],
    ['_padding', fixDecoderSize(getBytesDecoder(), 7)],
    [
      'instructionPrefix',
      fixDecoderSize(getBytesDecoder(), MAX_INSTRUCTION_PREFIX_LEN),
    ],
    ['sessionKey', fixDecoderSize(getBytesDecoder(), 32)],
    ['maxSessionLength', getU64Decoder()],
    ['currentSessionExpiration', getU64Decoder()],
  ]);
}

export const PROGRAM_EXEC_CONSTANTS = {
  MAX_INSTRUCTION_PREFIX_LEN,
  PROGRAM_EXEC_AUTHORITY_LEN,
  PROGRAM_EXEC_SESSION_AUTHORITY_LEN,
} as const;
