import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { AuthorityType, getProgramExecDecoder } from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import {
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../../solana';
import { findSwigSubAccountPdaRaw } from '../../utils';
import { Authority, TokenBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import type { InstructionDataOptions } from '../instructions/interface';
import { ProgramExecInstruction } from '../instructions/programexec';
import type { UpdateAuthorityActionsInfo } from '../updateAuthorityAction';
import type { ProgramExecBasedAuthority } from './based';

/**
 * ProgramExec Authority implementation.
 */
export class ProgramExecAuthority
  extends TokenBasedAuthority
  implements ProgramExecBasedAuthority
{
  type = AuthorityType.ProgramExec;

  constructor(data: Uint8Array) {
    super(data);
  }

  get id() {
    return this.programId.toBytes();
  }

  get signer() {
    return this.programId.toBytes();
  }

  get address() {
    return this.programId.toBytes();
  }

  get addressString() {
    return this.programId.toBase58();
  }

  get signerAddress() {
    return this.programId.toBytes();
  }

  get signerAddressString() {
    return this.programId.toBase58();
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

  private get info(): ProgramExecData {
    const data = getProgramExecDecoder().decode(this.data);
    return {
      programId: new Uint8Array(data.programId),
      instructionPrefixLen: data.instructionPrefixLen,
      instructionPrefix: new Uint8Array(data.instructionPrefix),
    };
  }

  sign(args: {
    swigAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.signV1Instruction(
      {
        swig: args.swigAddress,
        payer: args.payer,
      },
      {
        authorityData: this.data,
        innerInstructions: args.innerInstructions,
        roleId: args.roleId,
      },
      args.options,
    );
  }

  signV2(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.signV2Instruction(
      {
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
      },
      {
        authorityData: this.data,
        innerInstructions: args.innerInstructions,
        roleId: args.roleId,
      },
      args.options,
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
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.subAccountSignV1Instruction(
      {
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        innerInstructions: args.innerInstructions,
      },
      args.options,
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
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    roleId: number;
    options: InstructionDataOptions;
  }) {
    return ProgramExecInstruction.transferAssetsV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
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

export function isProgramExecAuthority(
  authority: Authority,
): authority is ProgramExecAuthority {
  return authority instanceof ProgramExecAuthority;
}

type ProgramExecData = {
  programId: Uint8Array;
  instructionPrefixLen: number;
  instructionPrefix: Uint8Array;
};
