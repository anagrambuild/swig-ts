import { bytesToHex } from '@noble/curves/abstract/utils';
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  AuthorityType,
  getSecp256k1SessionDecoder,
  type Secp256k1SessionAuthorityDataArgs,
} from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import {
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../../solana';
import {
  compressedPubkeyToAddress,
  findSwigSubAccountPdaRaw,
} from '../../utils';
import { SessionBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import { Ed25519Instruction, Secp256k1Instruction } from '../instructions';
import type { InstructionDataOptions } from '../instructions/interface';
import type { UpdateAuthorityActionsInfo } from '../updateAuthorityAction';
import type { Secp256k1BasedAuthority } from './based';

export class Secp256k1SessionAuthority
  extends SessionBasedAuthority
  implements Secp256k1BasedAuthority
{
  type = AuthorityType.Secp256k1Session;

  constructor(data: Uint8Array) {
    super(data);
  }

  get id() {
    return this.secp256k1Address;
  }

  get signer() {
    return this.sessionKey.toBytes();
  }

  get publicKeyBytes(): Uint8Array {
    return this.info.publicKey;
  }

  get publicKeyString(): string {
    return bytesToHex(this.publicKeyBytes);
  }

  get secp256k1Address() {
    return compressedPubkeyToAddress(this.publicKeyBytes);
  }

  get secp256k1AddressString(): string {
    return `Ox${bytesToHex(this.secp256k1Address)}`;
  }

  get secp256k1PublicKey() {
    return this.publicKeyBytes;
  }

  get secp256k1PublicKeyString() {
    return this.publicKeyString;
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
    const data: Secp256k1SessionAuthorityDataArgs =
      getSecp256k1SessionDecoder().decode(this.data);

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
    return Secp256k1Instruction.addAuthorityV1Instruction(
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
    return Secp256k1Instruction.removeAuthorityV1Instruction(
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
    return Secp256k1Instruction.updateAuthorityV1Instruction(
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
    return Secp256k1Instruction.createSessionV1Instruction(
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
    return Secp256k1Instruction.subAccountCreateV1Instruction(
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
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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
    return Secp256k1Instruction.subAccountToggleV1Instruction(
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
    swigSystemAddress: SolPublicKeyData;
    subAccount: SolPublicKeyData;
    roleId: number;
    amount: bigint;
    options: InstructionDataOptions;
  }) {
    return Secp256k1Instruction.subAccountWithdrawV1SolInstruction(
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
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
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
    const swigSystemAddress = new SolPublicKey(
      args.swigSystemAddress,
    ).toAddress();
    const subAccount = new SolPublicKey(args.subAccount).toAddress();
    const tokenProgram =
      new SolPublicKey(args.subAccount).toAddress() ?? TOKEN_PROGRAM_ADDRESS;

    const [swigToken] = await findAssociatedTokenPda({
      mint,
      owner: swigSystemAddress,
      tokenProgram,
    });

    const [subAccountToken] = await findAssociatedTokenPda({
      mint,
      owner: subAccount,
      tokenProgram,
    });

    return Secp256k1Instruction.subAccountWithdrawV1TokenInstruction(
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
    options: InstructionDataOptions;
  }) {
    return Secp256k1Instruction.transferAssetsV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        swigSystemAddress: args.swigAddress,
      },
      {
        roleId: args.roleId,
        authorityData: this.publicKeyBytes,
      },
      { ...args.options, odometer: args.options.odometer ?? this.odometer() },
    );
  }

  closeSwig(args: {
    swigAddress: SolPublicKeyData;
    swigSystemAddress: SolPublicKeyData;
    destination: SolPublicKeyData;
    roleId: number;
    options: InstructionDataOptions;
  }) {
    return Ed25519Instruction.closeSwigV1Instruction(
      {
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
        destination: args.destination,
      },
      {
        authorityData: this.sessionKey.toBytes(),
        roleId: args.roleId,
      },
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
    return Ed25519Instruction.closeTokenAccountV1Instruction(
      {
        swig: args.swigAddress,
        swigSystemAddress: args.swigSystemAddress,
        destination: args.destination,
        tokenProgram: args.tokenProgram,
      },
      {
        authorityData: this.sessionKey.toBytes(),
        roleId: args.roleId,
        tokenAccounts: args.tokenAccounts as any,
      },
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
