import { AccountRole } from '@solana/kit';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type CloseTokenAccountV1InstructionAccounts = {
  swig: SolPublicKeyData;
  swigSystemAddress: SolPublicKeyData;
  destination: SolPublicKeyData;
  tokenProgram: SolPublicKeyData;
};

export type CloseTokenAccountV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getCloseTokenAccountV1BaseAccountMetas(
  accounts: CloseTokenAccountV1InstructionAccounts,
): CloseTokenAccountV1BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.destination).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.tokenProgram).toAddress(),
      role: AccountRole.READONLY,
    }),
  ];
}

export type CloseTokenAccountV1BaseAccountMetasWithAuthority = [
  ...CloseTokenAccountV1BaseAccountMetas,
  SolAccountMeta,
];

export function getCloseTokenAccountV1BaseAccountMetasWithAuthority(
  accounts: CloseTokenAccountV1InstructionAccounts,
  authority: SolPublicKeyData,
): [CloseTokenAccountV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getCloseTokenAccountV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: CloseTokenAccountV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}
