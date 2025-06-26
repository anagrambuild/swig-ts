import {
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  type Address,
  type Commitment,
  type IInstruction,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  type TransactionSigner,
} from '@solana/kit';
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
 * @param rpc `Rpc<SolanaRpcApi>`
 * @param rpcSubscriptions `RpcSubscriptions<SolanaRpcSubscriptionsApi>` for transaction confirmation
 * @param id id pda seed
 * @param authorityInfo {@link CreateAuthorityInfo}
 * @param actions Actions the authority can perform
 * @param payer Ed25519 payer
 * @param options options
 * @returns `TransactionSignature`
 */
export async function createSwig(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  id: Uint8Array,
  authorityInfo: CreateAuthorityInfo,
  actions: Actions,
  payer: TransactionSigner,
  options?: { commitment?: Commitment },
): Promise<string> {
  const createInstruction = await Swig.create({
    authorityInfo,
    payer: payer.address,
    id,
    actions,
  });
  const signedTransaction = await createLegacyTransaction(
    rpc,
    [createInstruction],
    payer,
    options,
  );

  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirm(signedTransaction, {
    commitment: options?.commitment ?? 'confirmed',
  });
  return signature;
}

export function fetchNullableSwig(
  rpc: Rpc<SolanaRpcApi>,
  swigAddress: Address,
  config?: { commitment?: Commitment },
): Promise<Swig | null> {
  return Swig.fetchNullable(rpc, swigAddress, config);
}

export function fetchSwig(
  rpc: Rpc<SolanaRpcApi>,
  swigAddress: Address,
  config?: { commitment?: Commitment },
): Promise<Swig> {
  return Swig.fetch(rpc, swigAddress, config);
}

export async function getSignInstruction(
  rpc: Rpc<SolanaRpcApi>,
  instructons: IInstruction[],
  swigAddress: Address,
  authority: Authority,
  payer: Address,
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<IInstruction> {
  const swig = await fetchSwig(rpc, swigAddress, options);

  const role = swig.findRoleByAuthority(authority);

  if (!role) {
    throw new Error("Authority doesn't have a role on the swig");
  }

  const instOptions = signingFn && {
    signingFn,
    currentSlot: await rpc.getSlot(options).send(),
  };

  return signInstruction(role, payer, instructons, instOptions);
}

export async function signAndSend(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  instructons: IInstruction[],
  swigAddress: Address,
  authority: Authority,
  payer: Address,
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<string> {
  const signInstruction = await getSignInstruction(
    rpc,
    instructons,
    swigAddress,
    authority,
    payer,
    signingFn,
    options,
  );

  // Create a transaction signer for the payer
  const payerSigner: TransactionSigner = {
    address: payer,
    signTransactions: async () => {
      throw new Error('Payer must provide signing capability');
    },
  };

  const signedTransaction = await createLegacyTransaction(
    rpc,
    [signInstruction],
    payerSigner,
    options,
  );

  // todo: option for sending versioned
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirm(signedTransaction, {
    commitment: options?.commitment ?? 'confirmed',
  });
  return signature;
}

/**
 *
 * @param rpc
 * @param rpcSubscriptions
 * @param swigAddress
 * @param authority
 * @param newAuthority
 * @param actions
 * @param payer
 * @param signingFn
 * @param options
 * @returns
 */
export async function addAuthority(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  swigAddress: Address,
  authority: Authority,
  newAuthority: Authority,
  actions: Actions,
  payer: TransactionSigner,
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<string> {
  const swig = await fetchSwig(rpc, swigAddress, options);

  const role = swig.findRoleByAuthority(authority);

  if (!role) {
    throw new Error("Authority doesn't have a role on the swig");
  }

  if (!role.canManageAuthority())
    throw new Error('Role cannot manage authorities on the swig');

  const instOptions = signingFn && {
    signingFn,
    currentSlot: await rpc.getSlot(options).send(),
  };

  const addAuthorityIx = await addAuthorityInstruction(
    role,
    payer.address,
    newAuthority,
    actions,
    instOptions,
  );

  const signedTransaction = await createLegacyTransaction(
    rpc,
    [addAuthorityIx],
    payer,
    options,
  );

  // todo: option for sending versioned
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirm(signedTransaction, {
    commitment: options?.commitment ?? 'confirmed',
  });
  return signature;
}

export async function removeAuthority(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  swigAddress: Address,
  authority: Authority,
  authorityToRemove: Authority,
  payer: TransactionSigner,
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<string> {
  const swig = await fetchSwig(rpc, swigAddress, options);

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
    currentSlot: await rpc.getSlot(options).send(),
  };

  const removeAuthorityIx = await removeAuthorityInstruction(
    role,
    payer.address,
    roleToRemove,
    instOptions,
  );

  const signedTransaction = await createLegacyTransaction(
    rpc,
    [removeAuthorityIx],
    payer,
    options,
  );

  // todo: option for sending versioned
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirm(signedTransaction, {
    commitment: options?.commitment ?? 'confirmed',
  });
  return signature;
}

export async function removeAllAuthorityRoles(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  swigAddress: Address,
  authority: Authority,
  authorityToRemove: Authority,
  payer: TransactionSigner,
  signingFn?: SigningFn,
  options?: { commitment: Commitment },
): Promise<string[]> {
  const sigs: string[] = [];

  const swig = await fetchSwig(rpc, swigAddress, options);

  while (swig.findRoleByAuthority(authorityToRemove)) {
    const sig = await removeAuthority(
      rpc,
      rpcSubscriptions,
      swigAddress,
      authority,
      authorityToRemove,
      payer,
      signingFn,
      options,
    );

    sigs.push(sig);

    await swig.refetch(rpc, options);
  }

  return sigs;
}
