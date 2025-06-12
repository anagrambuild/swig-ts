import {
  Connection,
  PublicKey,
  type Commitment,
  type GetAccountInfoConfig,
} from '@solana/web3.js';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import { fetchMaybeSwigAccount, fetchSwigAccount } from '../accounts';
import { type Actions } from '../actions';
import { Authority, type CreateAuthorityInfo } from '../authority';
import { createSwigInstruction } from '../instructions';
import { deserializeRoles, type SessionBasedRole } from '../role';
import { getUnprefixedSecpBytes } from '../utils';

export class Swig {
  private constructor(
    public readonly address: PublicKey,
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
  findRoleBySessionKey(sessionKey: PublicKey): SessionBasedRole | null {
    const role = this.roles.find(
      (r) =>
        r.isSessionBased() &&
        r.authority.sessionKey.toBase58() === sessionKey.toBase58(),
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
    connection: Connection,
    swigAddress: PublicKey,
    config?: Commitment | GetAccountInfoConfig,
  ): Promise<Swig | null> {
    const maybeSwig = await fetchMaybeSwigAccount(
      connection,
      swigAddress,
      config,
    );
    if (!maybeSwig) {
      return null;
    }
    return new Swig(swigAddress, maybeSwig);
  }

  /**
   * Fetch a Swig. Throws an error if Swig account has not been created
   * @param connection Connection
   * @param swigAddress Swig address
   * @param config Commitment config
   * @returns Swig | null
   */
  static async fetch(
    connection: Connection,
    swigAddress: PublicKey,
    config?: Commitment | GetAccountInfoConfig,
  ): Promise<Swig> {
    const swig = await fetchSwigAccount(connection, swigAddress, config);

    return new Swig(swigAddress, swig);
  }

  /**
   * Refetch the swig to invalidate stale account data.
   * Updates the Swig with the lateset on-chain state
   * @param connection Connection
   * @param config Connection config
   */
  async refetch(
    connection: Connection,
    config?: Commitment | GetAccountInfoConfig,
  ) {
    const swig = await fetchSwigAccount(connection, this.address, config);
    this.account = swig;
  }

  /**
   * Get a swig from raw swig account data
   * @param swigAddress Swig address
   * @param accountData Raw account data
   * @returns Swig
   */
  static fromRawAccountData(swigAddress: PublicKey, accountData: Uint8Array) {
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
  static create(args: {
    payer: PublicKey;
    id: Uint8Array;
    actions: Actions;
    authorityInfo: CreateAuthorityInfo;
  }) {
    return createSwigInstruction(
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
   * Find a Role by Ed25519 Signer Publickey
   * @param signerPk Ed25519 Publickey
   * @returns Role[]
   */
  findRolesByEd25519SignerPk(signerPk: PublicKey) {
    return this.findRolesByAuthoritySigner(signerPk.toBytes());
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
