import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  AuthorityType,
  getSecp256r1SessionDecoder,
  type Secp256r1SessionAuthorityDataArgs,
} from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import {
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../../solana';
import { findSwigSubAccountPdaRaw } from '../../utils';
import { SessionBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import { Ed25519Instruction, Secp256r1Instruction } from '../instructions';
import type { InstructionDataOptions } from '../instructions/interface';
import type { UpdateAuthorityActionsInfo } from '../updateAuthorityAction';
import type { Secp256r1BasedAuthority } from './based';

export class Secp256r1SessionAuthority
  extends SessionBasedAuthority
  implements Secp256r1BasedAuthority
{
  type = AuthorityType.Secp256r1Session;

  constructor(data: Uint8Array) {
    super(data);
  }

  get id() {
    return this.secp256r1PublicKey;
  }

  get signer() {
    return this.sessionKey.toBytes();
  }

  get publicKeyBytes(): Uint8Array {
    return this.info.publicKey;
  }

  get secp256r1PublicKey() {
    return this.publicKeyBytes;
  }

  get sessionKey(): SolPublicKey {
    return this.info.sessionKey;
  }

  get expirySlot() {
    return this.info.currentSessionExpiration;
  }

  get maxDuration() {
    return this.info.maxSessionLength;
  }

  odometer() {
    return this.info.odometer + 1;
  }

  private get info(): SessionData {
    const data: Secp256r1SessionAuthorityDataArgs =
      getSecp256r1SessionDecoder().decode(this.data);

    return {
      ...data,
      publicKey: Uint8Array.from(data.publicKey),
      sessionKey: new SolPublicKey(new Uint8Array(data.sessionKey)),
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
    payer: SolPublicKeyData;
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
    return Secp256r1Instruction.addAuthorityV1Instruction(
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
        authorityData: this.data,
        authorityToRemoveId: args.roleIdToRemove,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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
    return Secp256r1Instruction.updateAuthorityV1Instruction(
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
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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
    return Secp256r1Instruction.createSessionV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        authorityData: this.data,
        roleId: args.roleId,
        sessionDuration: args.sessionDuration ?? this.maxDuration,
        sessionKey: new SolPublicKey(args.newSessionKey).toBytes(),
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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
        authorityData: this.data,
        bump,
      },
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
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
    return Secp256r1Instruction.subAccountToggleV1Instruction(
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
        authorityData: this.data,
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
    swigSystemAddress: SolPublicKeyData;
    roleId: number;
    roleIdToRemove: number;
    options: InstructionDataOptions;
  }) {
    return Secp256r1Instruction.transferAssetsV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
      },
      {
        authorityData: this.data,
        roleId: args.roleId,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }
}

type SessionData = {
  publicKey: Uint8Array;
  sessionKey: SolPublicKey;
  odometer: number;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};
