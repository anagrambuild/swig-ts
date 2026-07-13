export interface SolanaAccountMeta {
  pubkey: string;
  isSigner?: boolean;
  isWritable?: boolean;
}

export interface SolanaInstructionInput {
  programId: string;
  accounts: SolanaAccountMeta[];
  /**
   * Base64-encoded instruction data, or bytes to be encoded as base64.
   */
  data: string | Uint8Array;
}

export interface SolanaInstruction {
  programId: string;
  accounts: Required<SolanaAccountMeta>[];
  data: string;
}
