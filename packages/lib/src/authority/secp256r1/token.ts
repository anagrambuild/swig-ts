import { bytesToHex } from '@noble/curves/abstract/utils';
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
import { TokenBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import { Secp256r1Instruction } from '../instructions';
import type { InstructionDataOptions } from '../instructions/interface';
import type { Secp256r1BasedAuthority } from './based';

export class Secp256r1Authority
  extends TokenBasedAuthority
  implements Secp256r1BasedAuthority
{
  type = AuthorityType.Secp256r1;

  constructor(data: Uint8Array) {
    super(data);
  }

  get id() {
    return this.secp256r1PublicKey;
  }

  get signer() {
    return this.secp256r1PublicKey;
  }

  get secp256r1PublicKey() {
    return this.publicKeyBytes;
  }

  get secp256r1PublicKeyString() {
    return this.publicKeyString;
  }

  get publicKeyBytes(): Uint8Array {
    return this._initPublicKeyBytes;
  }

  private get _initPublicKeyBytes() {
    return this.data.slice(0, 33);
  }

  get publicKeyString(): string {
    return bytesToHex(this.publicKeyBytes);
  }

  odometer(): number {
    const view = new DataView(this.data.buffer);
    return view.getUint32(36, true) + 1;
  }

  sign(args: {
    swigAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.signV1Instruction(
      {
        swig: args.swigAddress,
        payer: args.payer,
      },
      {
        authorityData: this.publicKeyBytes,
        innerInstructions: args.innerInstructions,
        roleId: args.roleId,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  signV2(args: {
    swigAddress: SolPublicKeyData;
    swigWalletAddress: SolPublicKeyData;
    payer: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.signV2Instruction(
      {
        swig: args.swigAddress,
        payer: args.payer,
        swigWalletAddress: args.swigWalletAddress,
      },
      {
        authorityData: this.publicKeyBytes,
        innerInstructions: args.innerInstructions,
        roleId: args.roleId,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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
    return Secp256r1Instruction.addAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.actingRoleId,
        actions: args.actions.bytes(),
        authorityData: this.publicKeyBytes,
        newAuthorityData: args.newAuthorityInfo.data,
        newAuthorityType: args.newAuthorityInfo.type,
        noOfActions: args.actions.count,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  removeAuthority(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    roleId: number;
    roleIdToRemove: number;
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.removeAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.roleId,
        authorityData: this.publicKeyBytes,
        authorityToRemoveId: args.roleIdToRemove,
      },
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
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
    return Secp256r1Instruction.subAccountCreateV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.publicKeyBytes,
        bump,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  subAccountSign(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigWalletAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    innerInstructions: SolInstruction[];
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.subAccountSignV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.publicKeyBytes,
        innerInstructions: args.innerInstructions,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  subAccountToggle(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    enabled: boolean;
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.subAccountToggleV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.publicKeyBytes,
        enabled: args.enabled,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  subAccountWithdrawSol(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    amount: bigint;
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.subAccountWithdrawV1SolInstruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
      },
      {
        roleId: args.roleId,
        authorityData: this.publicKeyBytes,
        amount: args.amount,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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

    return Secp256r1Instruction.subAccountWithdrawV1TokenInstruction(
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
        authorityData: this.publicKeyBytes,
        amount: args.amount,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  transferAssets(args: {
    payer: SolPublicKeyData;
    swigAddress: SolPublicKeyData;
    swigWalletAddress: SolPublicKeyData;
    roleId: number;
    roleIdToRemove: number;
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.transferAssetsV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        swigWalletAddress: args.swigWalletAddress,
      },
      {
        authorityData: this.data,
        roleId: args.roleId,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }
}
