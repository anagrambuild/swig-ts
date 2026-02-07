import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type CloseSwigV1InstructionAccounts = {
  swig: SolPublicKeyData;
  swigSystemAddress: SolPublicKeyData;
  destination: SolPublicKeyData;
};

export type CloseSwigV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getCloseSwigV1BaseAccountMetas(
  accounts: CloseSwigV1InstructionAccounts,
): CloseSwigV1BaseAccountMetas {
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
      address: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING).toAddress(),
      role: AccountRole.READONLY,
    }),
  ];
}

export type CloseSwigV1BaseAccountMetasWithAuthority = [
  ...CloseSwigV1BaseAccountMetas,
  SolAccountMeta,
];

export function getCloseSwigV1BaseAccountMetasWithAuthority(
  accounts: CloseSwigV1InstructionAccounts,
  authority: SolPublicKeyData,
): [CloseSwigV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getCloseSwigV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: CloseSwigV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}
