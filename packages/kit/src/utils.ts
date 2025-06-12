import type {
  Address,
  IAccountLookupMeta,
  IAccountMeta,
  IInstruction,
  IInstructionWithAccounts,
  IInstructionWithData,
} from '@solana/kit';
import { SWIG_PROGRAM_ADDRESS } from './consts';

/**
 * Creates a SWIG Instruction with the swig program addresss
 */
export function swigInstuction(
  accounts: IAccountMeta[],
  data: Uint8Array,
): SwigInstruction {
  return createGenericInstruction(SWIG_PROGRAM_ADDRESS, accounts, data);
}

/**
 * create a generic Instruction
 */
export function createGenericInstruction<
  T extends string,
  U extends (IAccountMeta | IAccountLookupMeta)[],
>(
  programAddress: Address<T>,
  accounts: U,
  data: Uint8Array,
): GenericInstruction<T, U> {
  let instruction = {
    programAddress,
    accounts,
    data,
  };
  return instruction;
}

/**
 *  SwigInstruction
 */
export type SwigInstruction<T extends IAccountMeta[] = IAccountMeta[]> =
  GenericInstruction<Address<'swigNmWhy8RvUYXBKV5TSU8Hh3f4o5EczHouzBzEsLC'>, T>;

/**
 *  Generic Instruction
 */
export type GenericInstruction<
  T extends string = string,
  U extends (IAccountMeta | IAccountLookupMeta)[] = IAccountMeta[],
> = IInstruction<T> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<U>;

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
