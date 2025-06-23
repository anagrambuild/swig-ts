import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { p256 } from '@noble/curves/p256';
import { PublicKey, type TransactionInstruction } from '@solana/web3.js';
import { AuthorityType } from '@swig-wallet/coder';
import type { Actions } from '../../actions';
import { createSwigInstruction } from '../../instructions';
import { TokenBasedAuthority } from '../abstract';
import type { CreateAuthorityInfo } from '../createAuthority';
import type { InstructionDataOptions } from '../instructions/interface';
import { Secp256r1Instruction } from '../instructions/secp256r1';
import type { Secp256r1BasedAuthority } from './based';

export class Secp256r1Authority
  extends TokenBasedAuthority
  implements Secp256r1BasedAuthority
{
  type = AuthorityType.Secp256r1;

  constructor(data: Uint8Array, roleId?: number) {
    super(data, roleId ?? null);
  }

  get id() {
    return this.secp256r1PublicKey;
  }

  get signer() {
    return this.secp256r1PublicKey;
  }

  get publicKeyBytes(): Uint8Array {
    // For basic secp256r1 authority, the data is just the 33-byte compressed public key
    // if (this.data.length !== 33) {
    //   throw new Error(
    //     `Invalid secp256r1 authority data length: ${this.data.length}. Expected 33 bytes.`,
    //   );
    // }
    return this.data.slice(0, 33);
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

  // odometer() {
  //   // Basic secp256r1 authorities don't have an odometer
  //   return undefined;
  // }

  static fromString(publicKey: string): Secp256r1Authority {
    const bytes = hexToBytes(publicKey);
    return Secp256r1Authority.fromBytes(bytes);
  }

  static fromBytes(publicKey: Uint8Array): Secp256r1Authority {
    // Handle different public key formats
    let compressedPubkey: Uint8Array;
    if (publicKey.length === 33) {
      // Already compressed
      compressedPubkey = publicKey;
    } else if (publicKey.length === 65) {
      // Uncompressed format (65 bytes) - need to compress using p256
      const point = p256.ProjectivePoint.fromHex(publicKey);
      compressedPubkey = point.toRawBytes(true);
    } else {
      throw new Error(
        `Invalid public key length: ${publicKey.length}. Expected 33 (compressed) or 65 (uncompressed) bytes.`,
      );
    }

    return new this(compressedPubkey);
  }

  createAuthorityData(): Uint8Array {
    return this.data;
  }

  odometer(): number {
    // const bytes = this.data.slice(36)
    const view = new DataView(this.data.buffer);
    return view.getUint32(36, true) + 1;
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

  async sign(args: {
    swigAddress: PublicKey;
    payer: PublicKey;
    roleId: number;
    innerInstructions: TransactionInstruction[];
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
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  async addAuthority(args: {
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

  async removeAuthority(args: {
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
        authorityToRemoveId: args.roleIdToRemove,
        authorityData: this.publicKeyBytes,
      },
      { ...args.options, odometer: this.odometer() ?? args.options.odometer },
    );
  }

  // For token-based authorities, sub-account methods typically just throw
  async subAccountCreate(): Promise<TransactionInstruction[]> {
    throw new Error(
      'Sub-account operations not supported for basic Secp256r1 authority',
    );
  }

  async subAccountSign(): Promise<TransactionInstruction[]> {
    throw new Error(
      'Sub-account operations not supported for basic Secp256r1 authority',
    );
  }

  async subAccountToggle(): Promise<TransactionInstruction[]> {
    throw new Error(
      'Sub-account operations not supported for basic Secp256r1 authority',
    );
  }

  async subAccountWithdrawSol(): Promise<TransactionInstruction[]> {
    throw new Error(
      'Sub-account operations not supported for basic Secp256r1 authority',
    );
  }

  async subAccountWithdrawToken(): Promise<TransactionInstruction[]> {
    throw new Error(
      'Sub-account operations not supported for basic Secp256r1 authority',
    );
  }
}
