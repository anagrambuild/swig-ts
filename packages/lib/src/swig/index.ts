import { type Commitment } from '@solana/kit';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import { Actions, ensureProgramAction } from '../actions';
import {
  AddMultipleAuthoritiesInstructionContextBuilder,
  getMockAuthorityFromCreateAuthorityInfo,
  isEd25519BasedAuthority,
  isSessionBasedAuthority,
  type CreateAuthorityInfo,
  type SigningFn,
} from '../authority';
import { createV1SwigInstruction } from '../instructions';
import { deserializeRoles } from '../role';
import {
  SolInstruction,
  SolPublicKey,
  SwigInstructionContext,
  type SolPublicKeyData,
} from '../solana';
import {
  findSwigSubAccountPdaRaw,
  findSwigWalletAddressPdaRaw,
  getUnprefixedSecpBytes,
} from '../utils';

export class Swig {
  /**
   * Swig Account Address.
   * @deprecated use `Swig.accountAddress()` instead
   */
  readonly address: SolPublicKey;
  #fetchFn: SwigFetchFn;

  constructor(
    address: SolPublicKeyData,
    private account: SwigAccount,
    fetchFn?: SwigFetchFn,
  ) {
    this.address = new SolPublicKey(address);
    this.#fetchFn = fetchFn ?? defaultSwigFetchFn;
  }

  /**
   * Swig ID
   */
  get id() {
    return this.account.id;
  }

  accountVersion(): AccountVersion {
    // when a v1 account is created, the rent exempt lamport is stored
    // which is quaranteed to be greater than max bump value of 255.
    // hence we are able to use this condition to deduce the version of
    // the swig account.
    if (this.account.reserved_lamports_or_bump > 255n) {
      return 'v1';
    }
    return 'v2';
  }

  async walletAddress() {
    if (this.accountVersion() === 'v1') return this.accountAddress();
    return this.systemAddress();
  }

  /**
   * The Address of the Swig PDA Account that holds all details of the Swig.
   * The address is the wallet address of the swig for legacy account
   * @returns the swig account address
   */
  accountAddress() {
    return this.address;
  }

  /**
   * The Address of the System account associated with the new Swig account.
   * The Address is the wallet address of the swig for Swig Account v2
   * @returns the swig wallet address
   */
  async systemAddress() {
    return (await findSwigWalletAddressPdaRaw(this.address))[0];
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

  setSwigFetchFn = (fn: SwigFetchFn) => {
    this.#fetchFn = fn;
  };

  // /**
  //  * Refetch the swig to invalidate stale account data.
  //  * Updates the Swig with the lateset on-chain state
  //  * @param connection Connection
  //  * @param config Connection config
  //  */
  refetch = async <
    T extends { commitment?: Commitment } = { commitment?: Commitment },
  >(
    config?: T,
  ): Promise<Swig> => {
    this.account = await this.#fetchFn(this.address, config);

    return this;
  };

  /**
   * Get a swig from raw swig account data
   * @param swigAddress Swig address
   * @param accountData Raw account data
   * @returns Swig
   */
  static fromRawAccountData(
    swigAddress: SolPublicKeyData,
    accountData: Uint8Array,
  ) {
    const swigAccount = getSwigCodec().decode(accountData);
    return new Swig(swigAddress, swigAccount);
  }

  /**
   * Find a Role by a Role ID
   * @param id Role ID
   * @returns Role | null
   */
  findRoleById = (id: number) => {
    // if (options?.prefetch) {
    //   await this.refetch();
    // }
    const role = this.roles.find((role) => role.id === id) ?? null;

    return role;
  };

  /**
   * Find a {@link Role} by session key
   * @param sessionKey
   * @returns Session-based Role
   */
  findRoleBySessionKey = (sessionKey: SolPublicKeyData) => {
    const role = this.roles.find(
      (r) =>
        r.isSessionBased() &&
        r.authority.sessionKey.toBase58() ===
          new SolPublicKey(sessionKey).toBase58(),
    );
    if (!role) return null;
    return role;
  };

  /**
   * Find a Role by Authority Signer
   * @param signer Authority signer
   * @returns Role[]
   */
  findRolesByAuthoritySigner = (signer: Uint8Array) => {
    return this.roles.filter((role) => role.authority.matchesSigner(signer));
  };

  /**
   * Find a Role by Ed25519 Signer Publickey
   * @param signerPk Ed25519 Publickey
   * @returns Role[]
   */
  findRolesByEd25519SignerPk = (signerPk: SolPublicKeyData) => {
    return this.findRolesByAuthoritySigner(
      new SolPublicKey(signerPk).toBytes(),
    );
  };

  /**
   * Find a Role by Authority Signer
   * @param signerAddress Secp256k1 Signer Address hex or bytes
   * @returns Role[]
   */
  findRolesBySecp256k1SignerAddress = (signerAddress: Uint8Array | string) => {
    return this.findRolesByAuthoritySigner(
      getUnprefixedSecpBytes(signerAddress, 20),
    );
  };
}

export const getCreateSwigInstructionContext = (args: {
  payer: SolPublicKeyData;
  id: Uint8Array;
  actions: Actions;
  authorityInfo: CreateAuthorityInfo;
}) => {
  return createV1SwigInstruction(
    { payer: args.payer },
    {
      id: args.id,
      actions: args.actions.bytes(),
      authorityData: args.authorityInfo.data,
      authorityType: args.authorityInfo.type,
    },
  );
};

export const getCreateSwigWithMultipleAuthoritiesInstructionContextBuilder =
  (args: {
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
      },
    );
    return new AddMultipleAuthoritiesInstructionContextBuilder(
      args.swigAddress,
      getMockAuthorityFromCreateAuthorityInfo(args.authorityInfo),
      0,
      {
        ...args.options,
        payer: args.payer,
        createSwigInstructionContextPromise,
      },
    );
  };

export const getAddMultipleAuthoritiesInstructionsContextBuilder = async (
  swig: Swig,
  roleId: number,
  options?: SwigOptions,
): Promise<AddMultipleAuthoritiesInstructionContextBuilder> => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  return AddMultipleAuthoritiesInstructionContextBuilder.create({
    swigAddress: swig.address,
    authority: role.authority,
    roleId: role.id,
    options: { ...options, payer },
  });
};

export const getAddAuthorityInstructionContext = async (
  swig: Swig,
  roleId: number,
  newAuthorityInfo: CreateAuthorityInfo,
  actions: Actions,
  options?: SwigOptions,
): Promise<SwigInstructionContext> => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  const actionsWithProgram = ensureProgramAction(actions);
  return role.authority.addAuthority({
    actingRoleId: role.id,
    actions: actionsWithProgram,
    newAuthorityInfo,
    payer,
    swigAddress: swig.address,
    options,
  });
};

export const getRemoveAuthorityInstructionContext = async (
  swig: Swig,
  roleId: number,
  roleIdToRemove: number,
  options?: SwigOptions,
) => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  return role.authority.removeAuthority({
    roleId: role.id,
    roleIdToRemove,
    payer,
    swigAddress: swig.address,
    options,
  });
};

export const getSignInstructionContext = async (
  swig: Swig,
  roleId: number,
  innerInstructions: SolInstruction[],
  withSubAccount?: boolean,
  options?: SwigOptions,
) => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    true,
    options,
  );

  if (withSubAccount) {
    return role.authority.subAccountSign({
      swigAddress: role.swigAddress,
      subAccount: (await findSwigSubAccountPdaRaw(role.swigId, role.id))[0],
      payer,
      innerInstructions,
      roleId: role.id,
      options,
    });
  }

  if (swig.accountVersion() === 'v2') {
    return role.authority.signV2({
      roleId: role.id,
      innerInstructions,
      payer,
      swigAddress: swig.address,
      swigWalletAddress: await swig.systemAddress(),
      options,
    });
  }

  return role.authority.sign({
    roleId: role.id,
    innerInstructions,
    payer,
    swigAddress: swig.address,
    options,
  });
};

export const getCreateSessionInstructionContext = async (
  swig: Swig,
  roleId: number,
  newSessionKey: SolPublicKeyData,
  duration?: bigint,
  options?: SwigOptions,
) => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  if (!role.isSessionBased()) {
    throw new Error(
      `Cannot create session for Role Id: ${role.id}. Role is not a session-based`,
    );
  }

  return role.authority.createSession({
    roleId: role.id,
    newSessionKey,
    payer,
    swigAddress: swig.address,
    sessionDuration: duration,
    options,
  });
};

export const getCreateSubAccountInstructionContext = async (
  swig: Swig,
  roleId: number,
  options?: SwigOptions,
) => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  return role.authority.subAccountCreate({
    swigAddress: role.swigAddress,
    swigId: role.swigId,
    payer,
    roleId: role.id,
    options,
  });
};

export const getToggleSubAccountInstructionContext = async (
  swig: Swig,
  roleId: number,
  enabled: boolean,
  options?: SwigOptions,
) => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  return role.authority.subAccountToggle({
    swigAddress: role.swigAddress,
    subAccount: (await findSwigSubAccountPdaRaw(role.swigId, role.id))[0],
    payer,
    roleId: role.id,
    options,
    enabled,
  });
};

export const getWithdrawFromSubAccountInstructionContext = async <
  T extends SolPublicKeyData = SolPublicKeyData,
>(
  swig: Swig,
  roleId: number,
  args: WithdrawSubAccountArgs<T>,
  options?: SwigOptions,
) => {
  const { payer, role } = await assertInstructionOptions(
    swig,
    roleId,
    false,
    options,
  );

  const subAccount = new SolPublicKey(
    (await findSwigSubAccountPdaRaw(role.swigId, role.id))[0],
  );
  return 'mint' in args
    ? role.authority.subAccountWithdrawToken({
        swigAddress: role.swigAddress,
        subAccount,
        payer,
        roleId: role.id,
        options,
        amount: args.amount,
        mint: args.mint,
        tokenProgram: args.tokenProgram,
      })
    : role.authority.subAccountWithdrawSol({
        swigAddress: role.swigAddress,
        subAccount,
        payer,
        roleId: role.id,
        options,
        amount: args.amount,
      });
};

async function assertInstructionOptions(
  swig: Swig,
  roleId: number,
  isSignIx: boolean,
  options?: SwigOptions,
) {
  if (options?.preFetch) {
    await swig.refetch();
  }

  const role = swig.findRoleById(roleId);

  if (!role) throw new Error(`Role not found for ID: ${roleId}`);

  let payerBytes: SolPublicKeyData | undefined = undefined;

  if (options?.payer) {
    payerBytes = options.payer;
  } else if (
    isSignIx &&
    (isEd25519BasedAuthority(role.authority) ||
      isSessionBasedAuthority(role.authority))
  ) {
    payerBytes = role.authority.signer;
  } else if (!isSignIx && isEd25519BasedAuthority(role.authority)) {
    payerBytes = role.authority.id;
  }

  if (!payerBytes) {
    throw new Error(
      'payer not provided for non-ed25519 or session-based authority',
    );
  }

  const payer = new SolPublicKey(payerBytes);

  return { payer, role };
}

export type SwigOptions = {
  preFetch?: boolean;
  signingFn?: SigningFn;
  currentSlot?: bigint;
  payer?: SolPublicKeyData;
};

export type WithdrawSubAccountArgs<
  T extends SolPublicKeyData = SolPublicKeyData,
> =
  | { amount: bigint }
  | {
      amount: bigint;
      mint: T;
      tokenProgram?: T;
    };

export type SwigFetchFn<
  T extends SolPublicKeyData = SolPublicKeyData,
  OptionsWithCommitment extends { commitment?: Commitment } = {
    commitment?: Commitment;
  },
> = (swigAddress: T, config?: OptionsWithCommitment) => Promise<SwigAccount>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const defaultSwigFetchFn: SwigFetchFn = (_) => {
  throw new Error('Swig fetch fn not set!');
};

export type AccountVersion = 'v1' | 'v2';
