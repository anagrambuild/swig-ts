import type { Address } from '@solana/kit';
import {
  type FetchAccountConfig,
  type Rpc,
  type SolanaRpcApi,
} from '@solana/kit';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import bs58 from 'bs58';
import { fetchMaybeSwigAccount, fetchSwigAccount } from '../accounts';
import { type Actions } from '../actions';
import { Authority, type CreateAuthorityInfo } from '../authority';
import { createSwigInstruction } from '../instructions';
import { deserializeRoles, type SessionBasedRole } from '../role';
import { getUnprefixedSecpBytes } from '../utils';

export class Swig {
  private constructor(
    public readonly address: Address,
    private account: SwigAccount,
  ) {}

  /**
   * Swig ID
   */
  get id() {
    return this.account.id;
  }

  /**
   * Roles on the swig
   */
  get roles() {
    return deserializeRoles(
      this.address,
      Uint8Array.from(this.account.roles_buffer),
      this.account.roles,
      Uint8Array.from(this.account.id),
    );
  }

  /**
   * Find a {@link Role} by session key
   * @param sessionKey
   * @returns Session-based Role
   */
  findRoleBySessionKey(sessionKey: Address): SessionBasedRole | null {
    const role = this.roles.find(
      (r) => r.isSessionBased() && r.authority.sessionKey === sessionKey,
    );
    if (!role) return null;
    return role as SessionBasedRole;
  }

  /**
   * Fetch a Swig. Returns null if Swig account has not been created
   * @param connection Connection
   * @param swigAddress Swig address
   * @param config Commitment config
   * @returns Swig | null
   */
  static async fetchNullable(
    rpc: Rpc<SolanaRpcApi>,
    swigAddress: Address,
    config?: FetchAccountConfig,
  ): Promise<Swig | null> {
    const maybeSwig = await fetchMaybeSwigAccount(rpc, swigAddress, config);
    if (!('exists' in maybeSwig) || !(maybeSwig as any).exists) {
      return null;
    }
    return new Swig(swigAddress, (maybeSwig as any).account);
  }

  /**
   * Fetch a Swig. Throws an error if Swig account has not been created
   * @param connection Connection
   * @param swigAddress Swig address
   * @param config Commitment config
   * @returns Swig | null
   */
  static async fetch(
    rpc: Rpc<SolanaRpcApi>,
    swigAddress: Address,
    config?: FetchAccountConfig,
  ): Promise<Swig> {
    const swigAcc = await fetchSwigAccount(rpc, swigAddress, config);

    return new Swig(swigAddress, (swigAcc as any).account);
  }

  /**
   * Refetch the swig to invalidate stale account data.
   * Updates the Swig with the lateset on-chain state
   * @param connection Connection
   * @param config Connection config
   */
  async refetch(rpc: Rpc<SolanaRpcApi>, config?: FetchAccountConfig) {
    const swigAcc = await fetchSwigAccount(rpc, this.address, config);
    this.account = (swigAcc as any).account;
  }

  /**
   * Get a swig from raw swig account data
   * @param swigAddress Swig address
   * @param accountData Raw account data
   * @returns Swig
   */
  static fromRawAccountData(swigAddress: Address, accountData: Uint8Array) {
    const swigAccount = getSwigCodec().decode(accountData);
    return new Swig(swigAddress, swigAccount);
  }

  /**
   * Get `Create` instruction for creating a new Swig
   * @param args
   * @param args.payer Swig payer
   * @param args.id Swig ID
   * @returns Instruction for creating a Swig
   */
  static async create(args: {
    payer: Address;
    id: Uint8Array;
    actions: Actions;
    authorityInfo: CreateAuthorityInfo;
  }) {
    return await createSwigInstruction(
      { payer: args.payer },
      {
        id: args.id,
        actions: args.actions.bytes(),
        authorityData: args.authorityInfo.createAuthorityInfo.data,
        authorityType: args.authorityInfo.createAuthorityInfo.type,
        noOfActions: args.actions.count,
      },
    );
  }

  /**
   * Find a Role by Authority.
   * @param authority {@link Authority}
   * @returns Role | null
   */
  findRoleByAuthority(authority: Authority) {
    return this.roles.find((role) => role.authority.isEqual(authority)) ?? null;
  }

  /**
   * Find a Role by a Role ID
   * @param id Role ID
   * @returns Role | null
   */
  findRoleById(id: number) {
    return this.roles.find((role) => role.id === id) ?? null;
  }

  /**
   * Find a Role by Authority Signer
   * @param signer Authority signer
   * @returns Role[]
   */
  findRolesByAuthoritySigner(signer: Uint8Array) {
    return this.roles.filter((role) => role.authority.matchesSigner(signer));
  }

  /**
   * Find a Role by Ed25519 Signer Address
   * @param signerPk Ed25519 Address
   * @returns Role[]
   */
  findRolesByEd25519SignerPk(signerPk: Address) {
    const signerBytes = bs58.decode(signerPk);
    return this.findRolesByAuthoritySigner(signerBytes);
  }

  /**
   * Find a Role by Authority Signer
   * @param signerAddress Secp256k1 Signer Address hex or bytes
   * @returns Role[]
   */
  findRolesBySecp256k1SignerAddress(signerAddress: Uint8Array | string) {
    return this.findRolesByAuthoritySigner(
      getUnprefixedSecpBytes(signerAddress, 20),
    );
  }
}
