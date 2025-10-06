import type { ReadonlyUint8Array } from '@solana/kit';
import type {
  AddAuthorityV1InstructionDataArgs,
  CreateSessionV1InstructionDataArgs,
  RemoveAuthorityV1InstructionDataArgs,
  SubAccountCreateV1InstructionDataArgs,
  SubAccountToggleV1InstructionDataArgs,
  SubAccountWithdrawV1InstructionDataArgs,
  TransferAssetsV1InstructionDataArgs,
  UpdateAuthorityV1InstructionDataArgs,
} from '@swig-wallet/coder';
import {
  type AddAuthorityV1InstructionAccounts,
  type RemoveAuthorityV1InstructionAccounts,
  type SignV1InstructionAccounts,
  type SignV2InstructionAccounts,
  type SubAccountCreateV1InstructionAccounts,
  type SubAccountSignV1InstructionAccounts,
  type SubAccountToggleV1InstructionAccounts,
  type SubAccountWithdrawV1SolInstructionAccounts,
  type SubAccountWithdrawV1TokenInstructionAccounts,
  type TransferAssetsV1InstructionAccounts,
  type UpdateAuthorityV1InstructionAccounts,
} from '../../instructions';
import type { SolInstruction, SwigInstructionContext } from '../../solana';

/**
 * Authority Instruction Interface
 */
export interface AuthorityInstruction {
  addAuthorityV1Instruction(
    accounts: AddAuthorityV1InstructionAccounts,
    data: Omit<AddAuthorityV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  removeAuthorityV1Instruction(
    accounts: RemoveAuthorityV1InstructionAccounts,
    data: Omit<RemoveAuthorityV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  updateAuthorityV1Instruction(
    accounts: UpdateAuthorityV1InstructionAccounts,
    data: Omit<UpdateAuthorityV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  signV1Instruction(
    accounts: SignV1InstructionAccounts,
    data: {
      authorityData: ReadonlyUint8Array;
      roleId: number;
      innerInstructions: SolInstruction[];
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  signV2Instruction(
    accounts: SignV2InstructionAccounts,
    data: {
      authorityData: ReadonlyUint8Array;
      roleId: number;
      innerInstructions: SolInstruction[];
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  createSessionV1Instruction(
    accounts: SignV1InstructionAccounts,
    data: Omit<CreateSessionV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  subAccountCreateV1Instruction(
    accounts: SubAccountCreateV1InstructionAccounts,
    data: Omit<SubAccountCreateV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  subAccountSignV1Instruction(
    accounts: SubAccountSignV1InstructionAccounts,
    data: {
      authorityData: ReadonlyUint8Array;
      roleId: number;
      innerInstructions: SolInstruction[];
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  subAccountWithdrawV1SolInstruction(
    accounts: SubAccountWithdrawV1SolInstructionAccounts,
    data: Omit<SubAccountWithdrawV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  subAccountWithdrawV1TokenInstruction(
    accounts: SubAccountWithdrawV1TokenInstructionAccounts,
    data: Omit<SubAccountWithdrawV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  subAccountToggleV1Instruction(
    accounts: SubAccountToggleV1InstructionAccounts,
    data: Omit<SubAccountToggleV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;

  transferAssetsV1Instruction(
    accounts: TransferAssetsV1InstructionAccounts,
    data: Omit<TransferAssetsV1InstructionDataArgs, 'authorityPayload'> & {
      authorityData: ReadonlyUint8Array;
    },
    options?: InstructionDataOptions,
  ): Promise<SwigInstructionContext>;
}

/**
 * Signing interface that takes a message and returns a signature of the signed message
 */
export type SigningFn = (message: Uint8Array) => Promise<SigningResult>;

/**
 * @property signature - Signature of the message
 * @property prefix - Additional Prefix added to the message
 */
export type SigningResult = {
  signature: Uint8Array;
  prefix?: Uint8Array;
  message?: Uint8Array;
};

/**
 * Options used for constructing or signing instruction data.
 *
 * @property signingFn - {@link SigningFn}.
 * @property currentSlot - current slot.
 */
export type InstructionDataOptions = {
  signingFn?: SigningFn;
  currentSlot?: bigint;
  odometer?: number;
};
