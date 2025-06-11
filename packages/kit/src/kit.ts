import {
  getBytesEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
  type FetchAccountConfig,
  type GetAccountInfoApi,
  type ProgramDerivedAddress,
  type Rpc,
} from '@solana/kit';
import { getSwigCodec, type Role, type SwigAccount } from '@swig/coder';
import { fetchMaybeSwig } from './accounts';
import { SwigActions } from './actions/swig';
import { Authority } from './authority';
import { SWIG_PROGRAM_ADDRESS } from './consts';
import type { GenericInstruction } from './utils';

export async function findSwigPda(
  id: Uint8Array,
): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress: SWIG_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode('swig'), getBytesEncoder().encode(id)],
  });
}

export class Swig {
  private constructor(
    public address: Address,
    private account: SwigAccount,
  ) {}

  get id() {
    return this.account.id;
  }

  get roles() {
    return this.account.roles.map(
      (role: Role, i: number) => new SwigRole(role, this.address, i),
    );
  }

  static async get(
    rpc: Rpc<GetAccountInfoApi>,
    swigAddress: Address,
    config?: FetchAccountConfig,
  ): Promise<Swig | null> {
    let maybeSwig = await fetchMaybeSwig(rpc, swigAddress, config);
    if (!maybeSwig.exists) {
      return null;
    }
    return new Swig(maybeSwig.address, maybeSwig.data);
  }

  static fromRawAccountData(swigAddress: Address, accountData: Uint8Array) {
    let swigAccount = getSwigCodec().decode(accountData);
    return new Swig(swigAddress, swigAccount);
  }

  static async create(args: {
    payer: Address;
    id: Uint8Array;
    startSlot: bigint;
    endSlot: bigint;
    authority: Authority;
  }) {
    let [address, bump] = await findSwigPda(args.id);
    return args.authority.create({
      payer: args.payer,
      swigAddress: address,
      bump,
      endSlot: args.endSlot,
      startSlot: args.startSlot,
      id: args.id,
    });
  }

  findRoleByAuthority(authority: Authority) {
    return this.roles.find((role) => role.authority.isEqual(authority)) ?? null;
  }

  findRoleById(id: number) {
    return this.roles[id];
  }
}

export class SwigRole {
  private readonly actions: SwigActions;

  constructor(
    private role: Role,
    public swigAddress: Address,
    public id: number,
  ) {
    this.actions = new SwigActions(this.role.actions);
  }

  get authority(): Authority {
    return new Authority(
      new Uint8Array(this.role.authorityData),
      this.role.authorityType,
    );
  }

  /**
   *
   * @param args
   * @returns
   */
  sign(args: { payer: Address; innerInstructions: GenericInstruction[] }) {
    return this.authority.sign({
      swigAddress: this.swigAddress,
      payer: args.payer,
      innerInstructions: args.innerInstructions,
      roleId: this.id,
    });
  }

  addAuthority(args: {
    payer: Address;
    actions: SwigActions;
    newAuthority: Authority;
    startSlot: bigint;
    endSlot: bigint;
  }) {
    return this.authority.addAuthority({
      payer: args.payer,
      swigAddress: this.swigAddress,
      actingRoleId: this.id,
      actions: args.actions.rawActions(),
      startSlot: args.startSlot,
      endSlot: args.endSlot,
      newAuthority: args.newAuthority,
    });
  }

  removeAuthority(args: { payer: Address; roleToRemove: SwigRole }) {
    return this.authority.removeAuthority({
      payer: args.payer,
      swigAddress: this.swigAddress,
      roleId: this.id,
      roleIdToRemove: args.roleToRemove.id,
    });
  }

  replaceAuthority(args: {
    payer: Address;
    actions: SwigActions;
    newAuthority: Authority;
    startSlot: bigint;
    endSlot: bigint;
    roleToReplace: SwigRole;
  }) {
    return this.authority.replaceAuthority({
      payer: args.payer,
      swigAddress: this.swigAddress,
      roleId: this.id,
      actions: args.actions.rawActions(),
      roleIdToReplace: args.roleToReplace.id,
      endSlot: args.endSlot,
      startSlot: args.startSlot,
      newAuthority: args.newAuthority,
    });
  }

  hasAllAction() {
    return this.actions.hasAllAction();
  }

  canManageAuthority() {
    return this.actions.canManageAuthority();
  }

  canUseProgram(programId: Address) {
    return this.actions.canUseProgram(programId);
  }

  canSpendSolMax() {
    return this.actions.canSpendSolMax();
  }

  canSpendSol(amount?: bigint) {
    return this.actions.canSpendSol(amount);
  }

  canSpendAllTokensMax() {
    return this.actions.canSpendAllTokensMax();
  }

  canSpendAllTokens(amount?: bigint) {
    return this.actions.canSpendAllTokens(amount);
  }

  canSpendTokenMax(mint: Address) {
    return this.actions.canSpendTokenMax(mint);
  }

  canSpendToken(mint: Address, amount?: bigint) {
    return this.actions.canSpendToken(mint, amount);
  }
}
