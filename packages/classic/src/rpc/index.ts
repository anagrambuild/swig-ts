import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  TransactionInstruction,
  type Commitment,
  type Connection,
  type GetAccountInfoConfig,
  type Signer,
  type TransactionSignature,
} from '@solana/web3.js';
import type { Actions } from '../actions';
import type { Authority, CreateAuthorityInfo, SigningFn } from '../authority';
import {
  addAuthorityInstruction,
  removeAuthorityInstruction,
  signInstruction,
} from '../role';
import { Swig } from '../swig';
import { createLegacyTransaction } from '../utils';

/**
 * Creates a `SwigAccount`
 * @param connection `Connection`
 * @param id id pda seed
 * @param authorityInfo {@link CreateAuthorityInfo}
 * @param actions Actions the authority can perform
 * @param payer Ed25519 payer
 * @param signers Signers of the transaction
 * @param options options
 * @returns `TransactionSignature`
 */
export async function createSwig(
  connection: Connection,
  id: Uint8Array,
  authorityInfo: CreateAuthorityInfo,
  actions: Actions,
  payer: PublicKey,
  signers: Array<Signer>,
  options?: { commitment?: Commitment },
): Promise<TransactionSignature> {
  const createInstruction = Swig.create({
    authorityInfo,
    payer,
    id,
    actions,
  });
  const transaction = await createLegacyTransaction(
    connection,
    [createInstruction],
    payer,
    options,
  );

  return sendAndConfirmTransaction(connection, transaction, signers, options);
}

export function fetchNullableSwig(
  connection: Connection,
  swigAddress: PublicKey,
  config?: GetAccountInfoConfig,
): Promise<Swig | null> {
  return Swig.fetchNullable(connection, swigAddress, config);
}

export function fetchSwig(
  connection: Connection,
  swigAddress: PublicKey,
  config?: GetAccountInfoConfig,
): Promise<Swig> {
  return Swig.fetch(connection, swigAddress, config);
}

export async function getSignInstruction(
  connection: Connection,
  instructons: TransactionInstruction[],
  swigAddress: PublicKey,
  authority: Authority,
  payer: PublicKey,
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<TransactionInstruction> {
  const swig = await fetchSwig(connection, swigAddress, options);

  const role = swig.findRoleByAuthority(authority);

  if (!role) {
    throw new Error("Authority doesn't have a role on the swig");
  }

  const instOptions = signingFn && {
    signingFn,
    currentSlot: BigInt(await connection.getSlot(options)),
  };

  return signInstruction(role, payer, instructons, instOptions);
}

export async function signAndSend(
  connection: Connection,
  instructons: TransactionInstruction[],
  swigAddress: PublicKey,
  authority: Authority,
  payer: PublicKey,
  signers: Signer[] = [],
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<TransactionSignature> {
  const signInstruction = await getSignInstruction(
    connection,
    instructons,
    swigAddress,
    authority,
    payer,
    signingFn,
    options,
  );

  // todo: option for sending versioned
  const transaction = await createLegacyTransaction(
    connection,
    [signInstruction],
    payer,
    options,
  );

  return sendAndConfirmTransaction(connection, transaction, signers, options);
}

/**
 *
 * @param connection
 * @param swigAddress
 * @param authority
 * @param newAuthority
 * @param actions
 * @param payer
 * @param signers
 * @param options
 * @returns
 */
export async function addAuthority(
  connection: Connection,
  swigAddress: PublicKey,
  authority: Authority,
  newAuthority: Authority,
  actions: Actions,
  payer: Keypair,
  signers: Signer[] = [],
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<TransactionSignature> {
  const swig = await fetchSwig(connection, swigAddress, options);

  const role = swig.findRoleByAuthority(authority);

  if (!role) {
    throw new Error("Authority doesn't have a role on the swig");
  }

  if (!role.canManageAuthority())
    throw new Error('Role cannot manage authorities on the swig');

  const instOptions = signingFn && {
    signingFn,
    currentSlot: BigInt(await connection.getSlot(options)),
  };

  const addAuthorityIx = await addAuthorityInstruction(
    role,
    payer.publicKey,
    newAuthority,
    actions,
    instOptions,
  );

  // todo: option for sending versioned
  const transaction = await createLegacyTransaction(
    connection,
    [addAuthorityIx],
    payer.publicKey,
    options,
  );

  transaction.sign(payer, ...signers);

  return sendAndConfirmTransaction(connection, transaction, [], options);
}

export async function removeAuthority(
  connection: Connection,
  swigAddress: PublicKey,
  authority: Authority,
  authorityToRemove: Authority,
  payer: Keypair,
  signers: Signer[] = [],
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<TransactionSignature> {
  const swig = await fetchSwig(connection, swigAddress, options);

  const role = swig.findRoleByAuthority(authority);

  if (!role) {
    throw new Error("Authority doesn't have a role on the swig");
  }

  if (!role.canManageAuthority())
    throw new Error('Role cannot manage authorities on the swig');

  const roleToRemove = swig.findRoleByAuthority(authorityToRemove);

  if (!roleToRemove) {
    throw new Error('Authority role does not exist on the swig');
  }

  const instOptions = signingFn && {
    signingFn,
    currentSlot: BigInt(await connection.getSlot(options)),
  };

  const removeAuthorityIx = await removeAuthorityInstruction(
    role,
    payer.publicKey,
    roleToRemove,
    instOptions,
  );

  // todo: option for sending versioned
  const transaction = await createLegacyTransaction(
    connection,
    [removeAuthorityIx],
    payer.publicKey,
    options,
  );

  transaction.sign(payer, ...signers);

  return sendAndConfirmTransaction(connection, transaction, [], options);
}

export async function removeAllAuthorityRoles(
  connection: Connection,
  swigAddress: PublicKey,
  authority: Authority,
  authorityToRemove: Authority,
  payer: Keypair,
  signers: Signer[] = [],
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<TransactionSignature[]> {
  const sigs: TransactionSignature[] = [];

  const swig = await fetchSwig(connection, swigAddress, options);

  while (swig.findRoleByAuthority(authorityToRemove)) {
    const sig = await removeAuthority(
      connection,
      swigAddress,
      authority,
      authorityToRemove,
      payer,
      signers,
      signingFn,
      options,
    );

    sigs.push(sig);

    await swig.refetch(connection, options);
  }

  return sigs;
}
