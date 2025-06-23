import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { p256 } from '@noble/curves/p256';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, type TransactionInstruction } from '@solana/web3.js';
import {
  AuthorityType,
  getCreateSecp256r1SessionDecoder,
  getCreateSecp256r1SessionEncoder,
  getSecp256r1SessionDecoder,
  type Secp256r1SessionAuthorityDataArgs,
} from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import { createSwigInstruction } from '../../instructions';
import { findSwigSubAccountPda } from '../../utils';
import { SessionBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import { Ed25519Instruction, Secp256r1Instruction } from '../instructions';
import type { InstructionDataOptions } from '../instructions/interface';
import type { Secp256r1BasedAuthority } from './based';

export class Secp256r1SessionAuthority
  extends SessionBasedAuthority
  implements Secp256r1BasedAuthority
{
  type = AuthorityType.Secp256r1Session;

  constructor(data: Uint8Array, roleId?: number) {
    super(data, roleId ?? null);
  }

  get id() {
    return this.secp256r1PublicKey;
  }

  get signer() {
    return this.sessionKey.toBytes();
  }

  get publicKeyBytes(): Uint8Array {
    return this.isInitialized()
      ? this.info.publicKey
      : this._uninitPublicKeyBytes;
  }

  get publicKeyString(): string {
    return bytesToHex(this.publicKeyBytes);
  }

  get secp256r1PublicKey() {
    return this.publicKeyBytes;
  }

  get secp256r1PublicKeyString() {
    return this.publicKeyString;
  }

  get sessionKey(): PublicKey {
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

  private get _uninitPublicKeyBytes() {
    return this.info.publicKey;
  }

  private get info(): SessionData {
    const data: Secp256r1SessionAuthorityDataArgs = this.isInitialized()
      ? getSecp256r1SessionDecoder().decode(this.data)
      : {
          ...getCreateSecp256r1SessionDecoder().decode(this.data),
          odometer: 0,
          currentSessionExpiration: 0n,
        };
    return {
      ...data,
      publicKey: Uint8Array.from(data.publicKey),
      sessionKey: new PublicKey(data.sessionKey),
    };
  }

  static uninitializedString(
    publicKey: string,
    maxSessionDuration: bigint,
    sessionKey?: PublicKey,
  ): Secp256r1SessionAuthority {
    const bytes = hexToBytes(publicKey);
    return Secp256r1SessionAuthority.uninitialized(
      bytes,
      maxSessionDuration,
      sessionKey,
    );
  }

  static uninitialized(
    publicKey: string | Uint8Array,
    maxSessionDuration: bigint,
    sessionKey?: PublicKey,
  ): Secp256r1SessionAuthority {
    const pubkeyBytes =
      typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey;

    // Handle different public key formats
    let compressedPubkey: Uint8Array;
    if (pubkeyBytes.length === 33) {
      // Already compressed
      compressedPubkey = pubkeyBytes;
    } else if (pubkeyBytes.length === 65) {
      // Uncompressed format (65 bytes) - need to compress using p256
      const point = p256.ProjectivePoint.fromHex(pubkeyBytes);
      compressedPubkey = point.toRawBytes(true);
    } else {
      throw new Error(
        `Invalid public key length: ${pubkeyBytes.length}. Expected 33 (compressed) or 65 (uncompressed) bytes.`,
      );
    }

    const sessionData = getCreateSecp256r1SessionEncoder().encode({
      publicKey: compressedPubkey,
      sessionKey: sessionKey
        ? sessionKey.toBytes()
        : Uint8Array.from(Array(32)),
      maxSessionLength: maxSessionDuration,
    });

    return new this(Uint8Array.from(sessionData));
  }

  createAuthorityData(): Uint8Array {
    return this.data;
  }

  create(args: { payer: PublicKey; id: Uint8Array; actions: Actions }) {
    return createSwigInstruction(
      { payer: args.payer },
      {
        authorityData: this.createAuthorityData(),
        id: args.id,
        actions: args.actions.bytes(),
        authorityType: this.type,
        noOfActions: args.actions.count,
      },
    );
  }

  sign(args: {
    swigAddress: PublicKey;
    payer: PublicKey;
    roleId: number;
    innerInstructions: TransactionInstruction[];
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

  addAuthority(args: {
    swigAddress: PublicKey;
    payer: PublicKey;
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
        newAuthorityData: args.newAuthorityInfo.createAuthorityInfo.data,
        newAuthorityType: args.newAuthorityInfo.createAuthorityInfo.type,
        noOfActions: args.actions.count,
      },
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  removeAuthority(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
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

  createSession(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
    newSessionKey: PublicKey;
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
        authorityData: this.publicKeyBytes,
        roleId: args.roleId,
        sessionDuration: args.sessionDuration ?? this.maxDuration,
        sessionKey: args.newSessionKey.toBytes(),
      },
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  subAccountCreate(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
    swigId: Uint8Array;
    roleId: number;
    options: InstructionDataOptions;
  }) {
    const [subAccount, bump] = findSwigSubAccountPda(args.swigId, args.roleId);
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
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  subAccountSign(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
    subAccount: PublicKey;
    roleId: number;
    innerInstructions: TransactionInstruction[];
  }) {
    return Ed25519Instruction.subAccountSignV1Instruction(
      {
        payer: args.payer,
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
    payer: PublicKey;
    swigAddress: PublicKey;
    subAccount: PublicKey;
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
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  subAccountWithdrawSol(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
    subAccount: PublicKey;
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
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  subAccountWithdrawToken(args: {
    payer: PublicKey;
    swigAddress: PublicKey;
    subAccount: PublicKey;
    roleId: number;
    mint: PublicKey;
    amount: bigint;
    tokenProgram?: PublicKey;
    options: InstructionDataOptions;
  }) {
    const swigToken = getAssociatedTokenAddressSync(
      args.mint,
      args.swigAddress,
      true,
      args.tokenProgram,
    );
    const subAccountToken = getAssociatedTokenAddressSync(
      args.mint,
      args.subAccount,
      true,
      args.tokenProgram,
    );

    return Secp256r1Instruction.subAccountWithdrawV1TokenInstruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
        subAccount: args.subAccount,
        subAccountToken,
        swigToken,
        tokenProgram: args.tokenProgram ?? TOKEN_PROGRAM_ID,
      },
      {
        roleId: args.roleId,
        authorityData: this.publicKeyBytes,
        amount: args.amount,
      },
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }
}

type SessionData = {
  publicKey: Uint8Array;
  sessionKey: PublicKey;
  odometer: number;
  maxSessionLength: bigint;
  currentSessionExpiration: bigint;
};
