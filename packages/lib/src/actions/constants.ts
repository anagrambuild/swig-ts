import { SolPublicKey, type SolPublicKeyData } from '../solana';

/**
 * Curated program IDs that are commonly used and considered safe.
 * This list mirrors the on-chain CURATED_PROGRAMS in swig-wallet/state/src/action/program_curated.rs
 */
export const CURATED_PROGRAMS = [
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // SPL Token 2022
  'Stake11111111111111111111111111111111111111', // Stake Program
] as const;

/**
 * Type for curated program IDs
 */
export type CuratedProgram = (typeof CURATED_PROGRAMS)[number];

/**
 * Checks if a program ID is in the curated list
 * @param programId The program ID to check
 * @returns true if the program is in the curated list
 */
export function isCuratedProgram(programId: SolPublicKeyData): boolean {
  const base58 = new SolPublicKey(programId).toBase58();
  return (CURATED_PROGRAMS as readonly string[]).includes(base58);
}
