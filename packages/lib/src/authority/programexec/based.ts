import type { SolPublicKey } from '../../solana';
import type { Authority } from '../abstract';

/**
 * Interface for ProgramExec-based authorities.
 *
 * Program execution authorities validate that a preceding instruction
 * in the transaction was executed by a specific program with a matching
 * instruction prefix.
 */
export interface ProgramExecBasedAuthority {
  /** The program ID that must execute the preceding instruction (32 bytes) */
  programId: SolPublicKey;
  /** The instruction data prefix that must match */
  instructionPrefix: Uint8Array;
  /** Length of the instruction prefix to match (0-40) */
  instructionPrefixLen: number;
}

/**
 * Type guard to check if an authority is a ProgramExec-based authority.
 */
export function isProgramExecBasedAuthority(
  authority: Authority,
): authority is Authority & ProgramExecBasedAuthority {
  return 'programId' in authority && 'instructionPrefix' in authority;
}

/**
 * Get ProgramExec-based authority data if the authority is ProgramExec-based.
 */
export function getProgramExecBasedAuthority(authority: Authority) {
  if (!isProgramExecBasedAuthority(authority)) return null;
  return authority;
}
