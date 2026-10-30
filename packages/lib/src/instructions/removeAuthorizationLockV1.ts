import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type RemoveAuthorizationLockV1InstructionAccounts = {
  swig: SolPublicKeyData;
  /** Canonical swig wallet address PDA. */
  swigSystemAddress: SolPublicKeyData;
  payer: SolPublicKeyData;
  /**
   * The wallet's configured rent claimer. Required when the wallet has one;
   * the freed rent goes there instead of to the payer.
   */
  rentClaimer?: SolPublicKeyData;
};

export type RemoveAuthorizationLockV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

/** Base account metas plus the optional trailing accounts. */
export type RemoveAuthorizationLockV1AccountMetas = [
  ...RemoveAuthorizationLockV1BaseAccountMetas,
  ...SolAccountMeta[],
];

export function getRemoveAuthorizationLockV1BaseAccountMetas(
  accounts: RemoveAuthorizationLockV1InstructionAccounts,
): RemoveAuthorizationLockV1AccountMetas {
  const metas: RemoveAuthorizationLockV1AccountMetas = [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
      role: AccountRole.READONLY,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING).toAddress(),
      role: AccountRole.READONLY,
    }),
  ];

  if (accounts.rentClaimer !== undefined) {
    metas.push(
      SolAccountMeta.fromKitAccountMeta({
        address: new SolPublicKey(accounts.rentClaimer).toAddress(),
        role: AccountRole.WRITABLE,
      }),
    );
  }

  return metas;
}

export type RemoveAuthorizationLockV1BaseAccountMetasWithAuthority =
  RemoveAuthorizationLockV1AccountMetas;

export function getRemoveAuthorizationLockV1BaseAccountMetasWithAuthority(
  accounts: RemoveAuthorizationLockV1InstructionAccounts,
  authority: SolPublicKeyData,
): [RemoveAuthorizationLockV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getRemoveAuthorizationLockV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: RemoveAuthorizationLockV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}
