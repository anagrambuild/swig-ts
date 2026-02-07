import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  AuthorityType,
  getProgramExecSessionDecoder,
} from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import {
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../../solana';
import { findSwigSubAccountPdaRaw } from '../../utils';
import { Authority, SessionBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import { Ed25519Instruction } from '../instructions/ed25519';
import type { InstructionDataOptions } from '../instructions/interface';
import { ProgramExecInstruction } from '../instructions/programexec';
import type { UpdateAuthorityActionsInfo } from '../updateAuthorityAction';
import type { ProgramExecBasedAuthority } from './based';

/**
 * ProgramExec Session Authority implementation.
 */
export class ProgramExecSessionAuthority
  extends SessionBasedAuthority
  implements ProgramExecBasedAuthority
{
  type = AuthorityType.ProgramExecSession;

  constructor(public data: Uint8Array) {
    super(data);
  }

  static fromBytes(bytes: Uint8Array): ProgramExecSessionAuthority {
    return new ProgramExecSessionAuthority(bytes);
  }

  get id() {
    return this.programId.toBytes();
  }

  get signer() {
    return this.sessionKey.toBytes();
  }

  get programId() {
    return new SolPublicKey(this.info.programId);
  }

  get instructionPrefix() {
    return this.info.instructionPrefix.slice(0, this.info.instructionPrefixLen);
  }

  get instructionPrefixLen() {
    return this.info.instructionPrefixLen;
  }

  get sessionKey() {
    return this.info.sessionKey;
  }

  get expirySlot() {
    return this.info.currentSessionExpiration;
  }

  get maxDuration() {
    return this.info.maxSessionLength;
  }

  private get info(): ProgramExecSessionData {
    const data = getProgramExecSessionDecoder().decode(this.data);
    return {
      programId: new Uint8Array(data.programId),
      instructionPrefixLen: data.instructionPrefixLen,
      instructionPrefix: new Uint8Array(data.instructionPrefix),
      sessionKey: new SolPublicKey(new Uint8Array(data.sessionKey)),
      maxSessionLength: data.maxSessionLength,
      currentSessionExpiration: data.currentSessionExpiration,
    };
  }

  sign(args: {
    swigAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
  }) {
    return Ed25519Instruction.signV1Instruction(
      {
        swig: args.swigAddress,
        payer: args.payer,
      },
      {
        authorityData: this.sessionKey.toBytes(),
        innerInstructions: args.innerInstructions,
        roleId: args.roleId,
      },
    );
  }

  signV2(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
  }) {
    return Ed25519Instruction.signV2Instruction(
      {
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
      },
      {
        authorityData: this.sessionKey.toBytes(),
        innerInstructions: args.innerInstructions,
        roleId: args.roleId,
      },
    );
  }

  addAuthority(args: {
    swigAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    actingRoleId: number;
    actions: Actions;
    newAuthorityInfo: CreateAuthorityInfo;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.addAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.actingRoleId,
        actions: args.actions.bytes(),
        authorityData: this.data,
        newAuthorityData: args.newAuthorityInfo.data,
        newAuthorityType: args.newAuthorityInfo.type,
        noOfActions: args.actions.count,
      },
      args.options,
    );
  }

  removeAuthority(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    roleIdToRemove: number;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.removeAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.roleId,
        authorityData: this.data,
        authorityToRemoveId: args.roleIdToRemove,
      },
      args.options,
    );
  }

  updateAuthority(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    roleIdToUpdate: number;
    updateActionsInfo: UpdateAuthorityActionsInfo;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.updateAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.roleId,
        authorityData: this.data,
        authorityToUpdateId: args.roleIdToUpdate,
        updateActionsPayload: args.updateActionsInfo.data,
      },
      args.options,
    );
  }

  createSession(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    newSessionKey: SolPublicKeyData;
    roleId: number;
    sessionDuration?: bigint;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.createSessionV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        authorityData: this.data.slice(0, 80),
        roleId: args.roleId,
        sessionDuration: args.sessionDuration ?? this.maxDuration,
        sessionKey: new SolPublicKey(args.newSessionKey).toBytes(),
      },
      args.options,
    );
  }

  async subAccountCreate(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigId: Uint8Array;
    roleId: number;
    options: InstructionDataOptions;
  }) {
    const [subAccount, bump] = await findSwigSubAccountPdaRaw(
      args.swigId,
      args.roleId,
    );
    return ProgramExecInstruction.subAccountCreateV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        bump,
      },
      args.options,
    );
  }

  subAccountSign(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
  }) {
    // Session-based sub-account sign uses the session key
    return Ed25519Instruction.subAccountSignV1Instruction(
      {
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.sessionKey.toBytes(),
        innerInstructions: args.innerInstructions,
      },
    );
  }

  subAccountToggle(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    subAccountRoleId: number;
    actingRoleId: number;
    enabled: boolean;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.subAccountToggleV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        subAccountRoleId: args.subAccountRoleId,
        actingRoleId: args.actingRoleId,
        authorityData: this.data,
        enabled: args.enabled,
      },
      args.options,
    );
  }

  subAccountWithdrawSol(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    amount: bigint;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.subAccountWithdrawV1SolInstruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        amount: args.amount,
      },
      args.options,
    );
  }

  async subAccountWithdrawToken(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    mint: SolPublicKeyData;
    amount: bigint;
    tokenProgram?: SolPublicKeyData;
    options: InstructionDataOptions;
  }) {
    const mint = new SolPublicKey(args.mint).toAddress();
    const swigAddress = new SolPublicKey(args.swigAddress).toAddress();
    const subAccount = new SolPublicKey(args.subAccount).toAddress();
    const tokenProgram =
      new SolPublicKey(args.subAccount).toAddress() ?? TOKEN_PROGRAM_ADDRESS;

    const [swigToken] = await findAssociatedTokenPda({
      mint,
      owner: swigAddress,
      tokenProgram,
    });

    const [subAccountToken] = await findAssociatedTokenPda({
      mint,
      owner: subAccount,
      tokenProgram,
    });
    return ProgramExecInstruction.subAccountWithdrawV1TokenInstruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
        subAccount: args.subAccount,
        subAccountToken,
        swigToken,
        tokenProgram,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        amount: args.amount,
      },
      args.options,
    );
  }

  transferAssets(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    roleId: number;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.transferAssetsV1Instruction(
      {
        swig: args.swigAddress,
        payer: args.payer,
        swigSystemAddress: args.swigSystemAddress,
      },
      {
        authorityData: this.data,
        roleId: args.roleId,
      },
      args.options,
    );
  }

  closeSwig(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    destination: SolPublicKeyData;
    roleId: number;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.closeSwigV1Instruction(
      {
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
        destination: args.destination,
      },
      {
        authorityData: this.data,
        roleId: args.roleId,
      },
      args.options,
    );
  }

  closeTokenAccount(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    destination: SolPublicKeyData;
    tokenProgram: SolPublicKeyData;
    tokenAccounts: SolPublicKeyData[];
    roleId: number;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.closeTokenAccountV1Instruction(
      {
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
        destination: args.destination,
        tokenProgram: args.tokenProgram,
      },
      {
        authorityData: this.data,
        roleId: args.roleId,
        tokenAccounts: args.tokenAccounts as any,
      },
      args.options,
    );
  }
}

export function isProgramExecSessionAuthority(
  authority: Authority,
): authority is ProgramExecSessionAuthority {
  return authority instanceof ProgramExecSessionAuthority;
}

type ProgramExecSessionData = {
  programId: Uint8Array;
  instructionPrefixLen: number;
  instructionPrefix: Uint8Array;
  sessionKey: SolPublicKey;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};
