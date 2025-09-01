import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { AuthorityType } from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import {
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../../solana';
import { findSwigSubAccountPdaRaw } from '../../utils';
import { Authority, TokenBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import { Ed25519Instruction } from '../instructions';
import type { Ed25519BasedAuthority } from './based';

export class Ed25519Authority
  extends TokenBasedAuthority
  implements Ed25519BasedAuthority
{
  type = AuthorityType.Ed25519;

  constructor(data: Uint8Array) {
    super(data);
  }

  get id() {
    return this.data;
  }

  get signer() {
    return this.data;
  }

  get ed25519PublicKey() {
    return new SolPublicKey(this.data);
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
        authorityData: this.data,
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
  }) {
    return Ed25519Instruction.addAuthorityV1Instruction(
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
    );
  }

  removeAuthority(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    roleIdToRemove: number;
  }) {
    return Ed25519Instruction.removeAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.roleId,
        authorityData: this.data,
        authorityToRemoveId: args.roleIdToRemove,
      },
    );
  }

  async subAccountCreate(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigId: Uint8Array;
    roleId: number;
  }) {
    const [subAccount, bump] = await findSwigSubAccountPdaRaw(
      args.swigId,
      args.roleId,
    );
    return Ed25519Instruction.subAccountCreateV1Instruction(
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
    );
  }

  subAccountSign(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
  }) {
    return Ed25519Instruction.subAccountSignV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        innerInstructions: args.innerInstructions,
      },
    );
  }

  subAccountToggle(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    enabled: boolean;
  }) {
    return Ed25519Instruction.subAccountToggleV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        enabled: args.enabled,
      },
    );
  }

  subAccountWithdrawSol(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    amount: bigint;
  }) {
    return Ed25519Instruction.subAccountWithdrawV1SolInstruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.data,
        amount: args.amount,
      },
    );
  }

  async subAccountWithdrawToken(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    mint: SolPublicKeyData;
    amount: bigint;
    tokenProgram?: SolPublicKeyData;
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
    return Ed25519Instruction.subAccountWithdrawV1TokenInstruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
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
    );
  }
}

export function isEd25519Authority(
  authority: Authority,
): authority is Ed25519Authority {
  return authority instanceof Ed25519Authority;
}
