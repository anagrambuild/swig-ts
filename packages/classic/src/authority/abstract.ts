import { PublicKey, type TransactionInstruction } from '@solana/web3.js';
import { type AuthorityType } from '@swig/coder';
import type { Actions } from '../actions';
import { uint8ArraysEqual } from '../utils';
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

  constructor(
    public data: Uint8Array,
    public roleId: number | null,
  ) {}

  /**
   * Authority is initilized if a role id is assigned
   * @returns boolean
   */
  isInitialized(): boolean {
    return this.roleId !== null;
  }

  /**
   * Creates a `Swig` instruction for initializing a new entity on-chain.
   * @param args - The parameters required to create the Swig instruction.
   * @param args.payer - The public key of the account paying for the transaction.
   * @param args.id - 32-bytes Uint8Array.
   * @param args.actions - A container holding the set of actions to include.   * @returns The serialized instruction for creating the Swig.
   */
  abstract create(args: {
    payer: PublicKey;
    id: Uint8Array;
    actions: Actions;
  }): TransactionInstruction;

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
    swigAddress: PublicKey;
    payer: PublicKey;
    roleId: number;
    innerInstructions: TransactionInstruction[];
    options?: InstructionDataOptions;
  }): Promise<TransactionInstruction>;

  /**
   * Creates an `AddAuthority` Instructon
   *
   * @param args The parameters required to create the Swig instruction.
   * @param args.swigAddress The public key of the swig
   * @param args.payer The public key of the swig payer.
   * @param args.actingRoleId The ID of the role signing the instruction.
   * @param args.newAuthority Authority to add
   * @param args.actions Actions of the new authority
   * @param args.options {@link InstructionDataOptions}
   *
   * @returns `AddAuthority` Instruction.
   */
  abstract addAuthority(args: {
    swigAddress: PublicKey;
    payer: PublicKey;
    actingRoleId: number;
    actions: Actions;
    newAuthority: Authority;
    options?: InstructionDataOptions;
  }): Promise<TransactionInstruction>;

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
    payer: PublicKey;
    swigAddress: PublicKey;
    roleId: number;
    roleIdToRemove: number;
    options?: InstructionDataOptions;
  }): Promise<TransactionInstruction>;

  /**
   * Data required to create a new authority.
   *
   * this is usually used when creating a new Role from an unitialized authority, with the AddInstruction
   */
  abstract createAuthorityData(): Uint8Array;

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
  abstract sessionKey: PublicKey;
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
    payer: PublicKey;
    swigAddress: PublicKey;
    roleId: number;
    newSessionKey: PublicKey;
    sessionDuration?: bigint;
    options?: InstructionDataOptions;
  }): Promise<TransactionInstruction>;
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
