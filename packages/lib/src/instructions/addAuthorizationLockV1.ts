import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type AddAuthorizationLockV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
  swigSystemAddress: SolPublicKeyData;
  /** Swig wallet address (native SOL) or a token account it owns. */
  assetAccount: SolPublicKeyData;
  /**
   * Token mint. Omit for native SOL locks. Token locks pass it so the
   * program can check Token-2022 mint extensions.
   */
  mint?: SolPublicKeyData;
};

export type AddAuthorizationLockV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

/** Base account metas plus the optional trailing accounts. */
export type AddAuthorizationLockV1AccountMetas = [
  ...AddAuthorizationLockV1BaseAccountMetas,
  ...SolAccountMeta[],
];

export function getAddAuthorizationLockV1BaseAccountMetas(
  accounts: AddAuthorizationLockV1InstructionAccounts,
): AddAuthorizationLockV1AccountMetas {
  const metas: AddAuthorizationLockV1AccountMetas = [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING).toAddress(),
      role: AccountRole.READONLY,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
      role: AccountRole.READONLY,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.assetAccount).toAddress(),
      role: AccountRole.READONLY,
    }),
  ];

  if (accounts.mint !== undefined && !isNativeSolLockMint(accounts.mint)) {
    metas.push(
      SolAccountMeta.fromKitAccountMeta({
        address: new SolPublicKey(accounts.mint).toAddress(),
        role: AccountRole.READONLY,
      }),
    );
  }

  return metas;
}

export type AddAuthorizationLockV1BaseAccountMetasWithAuthority =
  AddAuthorizationLockV1AccountMetas;

export function getAddAuthorizationLockV1BaseAccountMetasWithAuthority(
  accounts: AddAuthorizationLockV1InstructionAccounts,
  authority: SolPublicKeyData,
): [AddAuthorizationLockV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getAddAuthorizationLockV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: AddAuthorizationLockV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}

/**
 * Returns the 32-byte mint value stored in an authorization lock:
 * all zeros for native SOL, otherwise the token mint.
 */
export function getAuthorizationLockMintBytes(
  mint?: SolPublicKeyData,
): Uint8Array {
  if (mint === undefined) return new Uint8Array(32);
  return new SolPublicKey(mint).toBytes();
}

function isNativeSolLockMint(mint: SolPublicKeyData): boolean {
  return new SolPublicKey(mint).toBytes().every((byte) => byte === 0);
}
