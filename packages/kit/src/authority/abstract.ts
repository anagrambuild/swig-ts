import type { Address } from '@solana/kit';
import { createSwigInstruction } from '../instructions';
import type { Action, AuthorityType } from '@swig/coder';
import { uint8ArraysEqual, type GenericInstruction } from '../utils';
import { getAuthorityConfig } from './config';

export class Authority {
  constructor(
    public data: Uint8Array,
    public type: AuthorityType,
  ) {}

  get config() {
    return getAuthorityConfig(this.type);
  }

  get instructions() {
    return this.config.instructions;
  }

  create(args: {
    payer: Address;
    swigAddress: Address;
    bump: number;
    id: Uint8Array;
    startSlot: bigint;
    endSlot: bigint;
  }) {
    return createSwigInstruction(
      { payer: args.payer, swig: args.swigAddress },
      {
        bump: args.bump,
        authorityData: this.data,
        endSlot: args.endSlot,
        startSlot: args.startSlot,
        id: args.id,
        initialAuthority: this.type,
      },
    );
  }

  sign(args: {
    swigAddress: Address;
    payer: Address;
    roleId: number;
    innerInstructions: GenericInstruction[];
  }) {
    return this.instructions.signV1Instruction(
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
    swigAddress: Address;
    payer: Address;
    actingRoleId: number;
    actions: Action[];
    newAuthority: Authority;
    startSlot: bigint;
    endSlot: bigint;
  }) {
    return this.instructions.addAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.actingRoleId,
        actions: args.actions,
        authorityData: this.data,
        startSlot: args.startSlot,
        endSlot: args.endSlot,
        newAuthorityData: args.newAuthority.data,
        newAuthorityType: args.newAuthority.type,
      },
    );
  }

  removeAuthority(args: {
    payer: Address;
    swigAddress: Address;
    roleId: number;
    roleIdToRemove: number;
  }) {
    return this.instructions.removeAuthorityV1Instruction(
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

  replaceAuthority(args: {
    swigAddress: Address;
    payer: Address;
    roleId: number;
    actions: Action[];
    newAuthority: Authority;
    startSlot: bigint;
    endSlot: bigint;
    roleIdToReplace: number;
  }) {
    return this.instructions.replaceAuthorityV1Instruction(
      {
        payer: args.payer,
        swig: args.swigAddress,
      },
      {
        actingRoleId: args.roleId,
        actions: args.actions,
        authorityData: this.data,
        authorityToReplaceId: args.roleIdToReplace,
        endSlot: args.endSlot,
        startSlot: args.startSlot,
        newAuthorityData: args.newAuthority.data,
        newAuthorityType: args.newAuthority.type,
      },
    );
  }

  isEqual(other: Authority): boolean {
    return uint8ArraysEqual(this.data, other.data) && this.type === other.type;
  }
}
