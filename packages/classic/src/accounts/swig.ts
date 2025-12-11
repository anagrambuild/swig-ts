import {
  PublicKey,
  type Commitment,
  type Connection,
  type GetAccountInfoConfig,
} from '@solana/web3.js';
import { getSwigCodec, type SwigAccount } from '@swig-wallet/coder';
import {
  getSwigSystemAddressRaw,
  getSwigWalletAddressRaw,
  SolPublicKey,
  Swig,
  type SolPublicKeyData,
  type SwigFetchFn,
} from '@swig-wallet/lib';
import { SWIG_PROGRAM_ADDRESS } from '../consts';

/**
 * Fetches a swig account. Will return `null` if the account is not found
 * @param connection `Connection`
 * @param swigAddress Public key of the Swig
 * @param config commitment or `GetAccountInfo` config
 * @returns `SwigAccount` | `null`
 */
export async function fetchMaybeSwigAccount(
  connection: Connection,
  swigAddress: PublicKey,
  config?: Commitment | GetAccountInfoConfig,
): Promise<SwigAccount | null> {
  const accountInfo = await connection.getAccountInfo(swigAddress, config);
  if (!accountInfo) return accountInfo;
  return getSwigCodec().decode(accountInfo.data);
}

/**
 * Fetches a swig raw account. Will throw error if account not found
 * @param connection Solana connection
 * @param swigAddress Public key of the Swig
 * @param config commitment or `GetAccountInfo` config
 * @returns `SwigAccount`
 */
export async function fetchSwigAccount(
  connection: Connection,
  swigAddress: PublicKey,
  config?: GetAccountInfoConfig,
): Promise<SwigAccount> {
  const maybeSwig = await fetchMaybeSwigAccount(
    connection,
    swigAddress,
    config,
  );
  if (!maybeSwig) throw new Error('Unable to fetch Swig account');
  return maybeSwig;
}

export async function fetchNullableSwig(
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
  return new Swig(swigAddress, maybeSwig, getSwigFetchFn(connection));
}

/**
 * Fetch a Swig. Throws an error if Swig account has not been created
 * @param connection Connection
 * @param swigAddress Swig address
 * @param config Commitment config
 * @returns Swig | null
 */
export async function fetchSwig(
  connection: Connection,
  swigAddress: PublicKey,
  config?: GetAccountInfoConfig,
): Promise<Swig> {
  const swig = await fetchSwigAccount(connection, swigAddress, config);

  return new Swig(swigAddress, swig, getSwigFetchFn(connection));
}

export const getSwigFetchFn = <T extends { commitment?: Commitment }>(
  connection: Connection,
  config?: T,
): SwigFetchFn => {
  return (swigAddress: SolPublicKeyData) => {
    const swigPublicKey = new SolPublicKey(swigAddress);
    return fetchSwigAccount(
      connection,
      new PublicKey(swigPublicKey.toBytes()),
      config,
    );
  };
};

/**
 * Utility for deriving a Swig PDA
 * @param id Swig ID
 * @returns [PublicKey, number]
 */
export function findSwigPda(id: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('swig'), Buffer.from(id)],
    SWIG_PROGRAM_ADDRESS,
  )[0];
}

/**
 * Utility for deriving a Swig PDA
 * @param id Swig ID
 * @returns [PublicKey, number]
 */
export function findSwigSubAccountPda(
  swigId: Uint8Array,
  roleId: number,
): PublicKey {
  const roleIdU32 = new Uint8Array(4);

  const view = new DataView(roleIdU32.buffer);
  view.setUint32(0, roleId, true);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('sub-account'), Buffer.from(swigId), Buffer.from(roleIdU32)],
    SWIG_PROGRAM_ADDRESS,
  )[0];
}

/**
 * Utility for deriving a Swig SubAccount PDA with index
 * Index 0 uses legacy 3-seed derivation for backwards compatibility
 * Indices 1-254 use new 4-seed derivation with index
 * @param swigId Swig ID
 * @param roleId Role ID
 * @param subAccountIndex Sub-account index (0-254, defaults to 0)
 * @returns PublicKey
 */
export function findSwigSubAccountPdaWithIndex(
  swigId: Uint8Array,
  roleId: number,
  subAccountIndex: number = 0,
): PublicKey {
  if (subAccountIndex < 0 || subAccountIndex > 254) {
    throw new Error('Sub-account index must be between 0 and 254');
  }

  const roleIdU32 = new Uint8Array(4);
  const view = new DataView(roleIdU32.buffer);
  view.setUint32(0, roleId, true);

  if (subAccountIndex === 0) {
    // Legacy derivation for index 0 (backwards compatible)
    return PublicKey.findProgramAddressSync(
      [Buffer.from('sub-account'), Buffer.from(swigId), Buffer.from(roleIdU32)],
      SWIG_PROGRAM_ADDRESS,
    )[0];
  } else {
    // New derivation for index 1-254 with index in seeds
    const indexU8 = new Uint8Array([subAccountIndex]);
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('sub-account'),
        Buffer.from(swigId),
        Buffer.from(roleIdU32),
        Buffer.from(indexU8),
      ],
      SWIG_PROGRAM_ADDRESS,
    )[0];
  }
}

export function getSwigAccountAddress(swig: Swig): PublicKey {
  const publicKeyBytes = getSwigAccountAddress(swig).toBytes();
  return new PublicKey(publicKeyBytes);
}

export async function getSwigSystemAddress(swig: Swig): Promise<PublicKey> {
  const publicKeyBytes = (await getSwigSystemAddressRaw(swig)).toBytes();
  return new PublicKey(publicKeyBytes);
}

export async function getSwigWalletAddress(swig: Swig): Promise<PublicKey> {
  const publicKeyBytes = (await getSwigWalletAddressRaw(swig)).toBytes();
  return new PublicKey(publicKeyBytes);
}
