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
import type { UpdateAuthorityActionsInfo } from './updateAuthorityAction';

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
   *
   * @deprecated Use {@link address} instead
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
   *
   * @deprecated Use {@link signerAddress} instead
   */
  abstract signer: Uint8Array;

  /**
   * The address that identifies this {@link Authority}.
   *
   * For Ed25519/ProgramExec: the public key bytes.
   * For Secp256k1: the 20-byte Ethereum address derived from the public key.
   * For Secp256r1: the compressed public key bytes.
   */
  abstract address: Uint8Array;

  /**
   * String representation of the authority {@link address}.
   *
   * For Ed25519/ProgramExec: base58 encoded.
   * For Secp256k1/Secp256r1: unprefixed hex.
   */
  abstract addressString: string;

  /**
   * The address that identifies the signer acting on behalf of this {@link Authority}.
   *
   * For {@link TokenBasedAuthority}: same as {@link address}.
   * For {@link SessionBasedAuthority}: the session key bytes.
   */
  abstract signerAddress: Uint8Array;

  /**
   * String representation of the {@link signerAddress}.
   *
   * For {@link TokenBasedAuthority}: same as {@link addressString}.
   * For {@link SessionBasedAuthority}: base58 encoded session key.
   */
  abstract signerAddressString: string;

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
   * Creates a `Sign` instruction for signing provided instructions with the Swig
   * @param args The parameters required to create the Swig instruction.
   * @param args.swigAddress The public key of the swig
   * @param args.payer The public key of the swig payer.
   * @param args.roleId The ID of the role signing the instruction.
   * @param args.innerInstructions The instructions the Swig is to sign.
   * @param args.options {@link InstructionDataOptions}
   * @returns `Sign` Instruction.
   */
  abstract signV2(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
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

  /**
   * Creates an `UpdateAuthority` Instructon
   *
   * @param args The parameters required for `RemoveAuthority` instruction.
   * @param args.swigAddress The public key of the swig account
   * @param args.payer The public key of the swig payer.
   * @param args.roleId The ID of the role signing the instruction.
   * @param args.roleIdToUpdate ID of the role to remove
   * @param args.options {@link InstructionDataOptions}
   * @returns `RemoveAuthority` Instruction.
   */
  abstract updateAuthority(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    roleIdToUpdate: number;
    updateActionsInfo: UpdateAuthorityActionsInfo;
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
    actingRoleId: number;
    subAccountRoleId: number;
    enabled: boolean;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountWithdrawSol(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    amount: bigint;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract subAccountWithdrawToken(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    mint: SolPublicKeyData;
    amount: bigint;
    tokenProgram?: SolPublicKeyData;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  abstract transferAssets(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    roleId: number;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  /**
   * Creates a `CloseSwig` instruction that closes the swig account and
   * wallet address PDA, transferring all remaining lamports to the destination.
   *
   * Requires `All` or `ManageAuthority` permission.
   * Both the swig account and wallet address PDA must have only rent-exempt
   * minimum lamports (no excess SOL).
   *
   * The account is resized to 1 byte with a `ClosedSwigAccount` discriminator
   * to prevent rehydration attacks.
   */
  abstract closeSwig(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    destination: SolPublicKeyData;
    roleId: number;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  /**
   * Creates a `CloseTokenAccount` instruction that closes token accounts
   * owned by the swig wallet address, transferring rent to the destination.
   *
   * Requires `All` or `ManageAuthority` permission.
   * Token accounts must have zero balance before closing.
   */
  abstract closeTokenAccount(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    destination: SolPublicKeyData;
    tokenProgram: SolPublicKeyData;
    tokenAccounts: SolPublicKeyData[];
    roleId: number;
    options?: InstructionDataOptions;
  }): Promise<SwigInstructionContext>;

  /**
   * Check two {@link Authority} are partially equal
   */
  isEqual(other: Authority): boolean {
    return (
      uint8ArraysEqual(this.address, other.address) && this.type === other.type
    );
  }

  /**
   * Check if the given address bytes match this authority's {@link address}.
   */
  matchesAddress(address: Uint8Array): boolean {
    return uint8ArraysEqual(this.address, address);
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
