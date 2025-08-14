import {
  Authority,
  isEd25519BasedAuthority,
  type CreateAuthorityInfo,
  type SigningFn,
} from '.';
import type { Actions } from '../actions';
import { createV1SwigInstruction } from '../instructions';
import { type SolPublicKeyData, type SwigInstructionContext } from '../solana';

export const getCreateSwigInstructionsBuilder = (args: {
  payer: SolPublicKeyData;
  swigAddress: SolPublicKeyData;
  id: Uint8Array;
  actions: Actions;
  authorityInfo: CreateAuthorityInfo;
  options: { signingFn?: SigningFn; currentSlot?: bigint };
}) => {
  const createSwigInstructionContextPromise = createV1SwigInstruction(
    { payer: args.payer },
    {
      id: args.id,
      actions: args.actions.bytes(),
      authorityData: args.authorityInfo.data,
      authorityType: args.authorityInfo.type,
      noOfActions: args.actions.count,
    },
  );
  return new AddAuthorityInstructionContextsBuilder(
    args.swigAddress,
    args.authorityInfo.writeOnlyAuthority,
    0,
    { ...args.options, payer: args.payer, createSwigInstructionContextPromise },
  );
};

export const getAddAuthoritiesInstructionsBuilder = (args: {
  swigAddress: SolPublicKeyData;
  authority: Authority;
  roleId: number;
  options?: AddAuthoritiesInstructionContextsConfig;
}) => {
  return new AddAuthorityInstructionContextsBuilder(
    args.swigAddress,
    args.authority,
    args.roleId,
    args.options,
  );
};

export class AddAuthorityInstructionContextsBuilder {
  #instructionContextPromises: Promise<SwigInstructionContext>[];

  constructor(
    public swigAddress: SolPublicKeyData,
    public authority: Authority,
    public roleId: number,
    public options?: AddAuthoritiesInstructionContextsConfig,
  ) {
    this.#instructionContextPromises = [];

    if (options?.createSwigInstructionContextPromise) {
      this.#instructionContextPromises.push(
        options?.createSwigInstructionContextPromise,
      );
    }
  }

  getPayer(): SolPublicKeyData {
    if (!isEd25519BasedAuthority(this.authority)) {
      if (!this.options?.payer)
        throw new Error('Payer not provided for Non-Ed25519 based authority!');
      return this.options.payer;
    }
    return this.options?.payer ?? this.authority.ed25519PublicKey;
  }

  addAuthority = (newAuthorityInfo: CreateAuthorityInfo, actions: Actions) => {
    const instructionContextPromise = this.authority.addAuthority({
      actingRoleId: this.roleId,
      actions,
      newAuthorityInfo,
      payer: this.getPayer(),
      swigAddress: this.swigAddress,
      options: this.options,
    });
    this.#instructionContextPromises.push(instructionContextPromise);
    return this;
  };

  getInstructionContexts = async () => {
    return Promise.all(this.#instructionContextPromises);
  };
}

export type AddAuthoritiesInstructionContextsConfig = {
  signingFn?: SigningFn;
  currentSlot?: bigint;
  payer?: SolPublicKeyData;
  createSwigInstructionContextPromise?: Promise<SwigInstructionContext>;
};
