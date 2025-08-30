import { type AuthorityType } from '@swig-wallet/coder';
import type { Actions } from '../actions';
import type {
  SolInstruction,
  SolPublicKey,
  SolPublicKeyData,
  SwigInstructionContext,
} from '../solana';
import { uint8ArraysEqual } from '../utils';
import type { CreateAuthorityInfo } from './createAuthority';
import type { InstructionDataOptions } from './instructions/interface';

export abstract class Authority {
  /**
   * Indicates if {@link Authority} is Session-based or not. `true` if Authority is Session-based
   */
  abstract session: boolean;

  /**
   * {@link AuthorityType}
   */
  abstract type: AuthorityType;
  /**
   * This is the ID for the {@link Authority}.
   *
   * This would usually the data that represents the Authority
   *
   * For {@link TokenBasedAuthority}, it is either a Ed25519 or Secp256k1 Public Key.
   *
   * For {@link SessionBasedAuthority}, It could be public key bytes, groth16 proof etc.
   */
  abstract id: Uint8Array;
  /**
   * This is the Signer ID for the {@link Authority}.
   *
   * This would usually the public key bytes that
   * identifies the signer on behalf of the authority,
   *
   * For {@link TokenBasedAuthority}, it is either a Ed25519 or Secp256k1 Public Key.
   *
   * For {@link SessionBasedAuthority}, it is the Session Key.
   */
  abstract signer: Uint8Array;

  constructor(public data: Uint8Array) {}

  /**
   * Creates a `Sign` instruction for signing provided instructions with the Swig
   * @param args The parameters required to create the Swig instruction.
   * @param args.swigAddress The public key of the swig
   * @param args.payer The public key of the swig payer.
   * @param args.roleId The ID of the role signing the instruction.
   * @param args.innerInstructions The instructions the Swig is to sign.
   * @param args.options {@link InstructionDataOptions}
   * @returns `Sign` Instruction.
   */
  abstract sign(args: {
    swigAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  /**
   * Creates an `AddAuthority` Instructon
   *
   * @param args The parameters required to create the Swig instruction.
   * @param args.swigAddress The public key of the swig
   * @param args.payer The public key of the swig payer.
   * @param args.actingRoleId The ID of the role signing the instruction.
   * @param args.newAuthorityInfo {@link CreateAuthorityInfo} of new Authority to add
   * @param args.actions Actions of the new authority
   * @param args.options {@link InstructionDataOptions}
   *
   * @returns `AddAuthority` Instruction.
   */
  abstract addAuthority(args: {
    swigAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    actingRoleId: number;
    actions: Actions;
    newAuthorityInfo: CreateAuthorityInfo;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  /**
   * Creates an `RemoveAuthority` Instructon
   *
   * @param args The parameters required for `RemoveAuthority` instruction.
   * @param args.swigAddress The public key of the swig
   * @param args.payer The public key of the swig payer.
   * @param args.roleId The ID of the role signing the instruction.
   * @param args.roleIdToRemove ID of the role to remove
   * @param args.options {@link InstructionDataOptions}
   * @returns `RemoveAuthority` Instruction.
   */
  abstract removeAuthority(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    roleIdToRemove: number;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountCreate(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigId: Uint8Array;
    roleId: number;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountSign(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountToggle(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    enabled: boolean;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountWithdrawSol(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    amount: bigint;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountWithdrawToken(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    mint: SolPublicKeyData;
    amount: bigint;
    tokenProgram?: SolPublicKeyData;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  /**
   * Check two {@link Authority} are partially equal
   */
  isEqual(other: Authority): boolean {
    return uint8ArraysEqual(this.id, other.id) && this.type === other.type;
  }

  /**
   * Check two {@link Authority} has the same signer.
   */
  matchesSigner(signer: Uint8Array): boolean {
    return uint8ArraysEqual(this.signer, signer);
  }
}

export abstract class TokenBasedAuthority extends Authority {
  session = false;
}

export abstract class SessionBasedAuthority extends Authority {
  session = true;

  /**
   * Ed25519 based Public Key as Session key
   */
  abstract sessionKey: SolPublicKey;
  /**
   * Slot when the session expires
   */
  abstract expirySlot: bigint;
  /**
   * Max duration on a session
   */
  abstract maxDuration: bigint;

  /**
   * Creates an `CreateSession` Instructon
   *
   * @param args The parameters required to create the Swig instruction.
   * @param args.swigAddress The public key of the swig
   * @param args.payer The public key of the swig payer.
   * @param args.roleId The ID of the role signing the instruction.
   * @param args.newSessionKey Ed25519 Public key of the Session key
   * @param args.sessionDuration Session duration in slots
   * @param args.options {@link InstructionDataOptions}
   *
   * @returns `AddAuthority` Instruction.
   */
  abstract createSession(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    newSessionKey: SolPublicKeyData;
    sessionDuration?: bigint;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;
}

/**
 * Utility to check if an {@link Authority} is Token-based Authority
 * @param authority {@link Authority}
 * @returns boolean
 */
export function isTokenBasedAuthority(
  authority: Authority,
): authority is TokenBasedAuthority {
  return authority instanceof TokenBasedAuthority;
}

/**
 * Utility to check if an {@link Authority} is Session-based Authority
 * @param authority {@link Authority}
 * @returns boolean
 */
export function isSessionBasedAuthority(
  authority: Authority,
): authority is SessionBasedAuthority {
  return authority instanceof SessionBasedAuthority;
}
