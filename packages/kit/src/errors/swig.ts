import {
  // isProgramError,
  type Address,
  type SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  type SolanaError,
} from '@solana/kit';
import { isProgramError } from '@solana/programs';
import type { SwigError } from '@swig/coder';
import { SWIG_PROGRAM_ADDRESS } from '../consts';

export function isSwigError<TProgramErrorCode extends SwigError>(
  error: unknown,
  transactionMessage: {
    instructions: Record<number, { programAddress: Address }>;
  },
  code?: TProgramErrorCode,
): error is SolanaError<typeof SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM> &
  Readonly<{ context: Readonly<{ code: TProgramErrorCode }> }> {
  return isProgramError<TProgramErrorCode>(
    error,
    transactionMessage,
    SWIG_PROGRAM_ADDRESS,
    code,
  );
}
