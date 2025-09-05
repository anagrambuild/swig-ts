import { ensureProgramAction, type Actions } from '../actions';
import { type SolPublicKeyData, type SwigInstructionContext } from '../solana';
import type { Authority } from './abstract';
import { type CreateAuthorityInfo } from './createAuthority';
import { isEd25519BasedAuthority } from './ed25519';
import type { SigningFn } from './instructions/interface';

export class AddMultipleAuthoritiesInstructionContextBuilder {
  #instructionContextPromises: Promise<SwigInstructionContext>[];
  #odometer: number;

  constructor(
    public swigAddress: SolPublicKeyData,
    public authority: Authority,
    public roleId: number,
    public options?: AddMultipleAuthoritiesInstructionContextBuilderConfig,
  ) {
    this.#instructionContextPromises = [];

    if (options?.createSwigInstructionContextPromise) {
      this.#instructionContextPromises.push(
        options?.createSwigInstructionContextPromise,
      );
    }

    if (options?.odometer) {
      this.#odometer = options.odometer;
    } else {
      this.#odometer = 1;
    }
  }

  static create = (args: {
    swigAddress: SolPublicKeyData;
    authority: Authority;
    roleId: number;
    options?: AddMultipleAuthoritiesInstructionContextBuilderConfig;
  }) => {
    return new AddMultipleAuthoritiesInstructionContextBuilder(
      args.swigAddress,
      args.authority,
      args.roleId,
      args.options,
    );
  };

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
      actions: ensureProgramAction(actions),
      newAuthorityInfo,
      payer: this.getPayer(),
      swigAddress: this.swigAddress,
      options: { ...this.options, odometer: this.#odometer },
    });
    this.#instructionContextPromises.push(instructionContextPromise);
    this.#odometer += 1;
    return this;
  };

  getInstructionContexts = async () => {
    return Promise.all(this.#instructionContextPromises);
  };
}

export type AddMultipleAuthoritiesInstructionContextBuilderConfig = {
  signingFn?: SigningFn;
  currentSlot?: bigint;
  payer?: SolPublicKeyData;
  createSwigInstructionContextPromise?: Promise<SwigInstructionContext>;
  odometer?: number;
};
