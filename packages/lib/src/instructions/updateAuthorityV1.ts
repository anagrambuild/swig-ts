import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type UpdateAuthorityV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type UpdateAuthorityV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getUpdateAuthorityV1BaseAccountMetas(
  accounts: UpdateAuthorityV1InstructionAccounts,
): UpdateAuthorityV1BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
    }),
  ];
}

export type UpdateAuthorityV1BaseAccountMetasWithAuthority = [
  ...UpdateAuthorityV1BaseAccountMetas,
  SolAccountMeta,
];

export function getUpdateAuthorityV1BaseAccountMetasWithAuthority(
  accounts: UpdateAuthorityV1InstructionAccounts,
  authority: SolPublicKeyData,
): [UpdateAuthorityV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getUpdateAuthorityV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: UpdateAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
      // isSigner: true,
      // isWritable: false,
    }),
  ];
  return [metas, authorityIndex];
}

export type UpdateAuthorityV1BaseAccountMetasWithSystemProgram = [
  ...UpdateAuthorityV1BaseAccountMetas,
  ...SolAccountMeta[],
];

export function getUpdateAuthorityV1BaseAccountMetasWithSystemProgram(
  accounts: UpdateAuthorityV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): UpdateAuthorityV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getUpdateAuthorityV1BaseAccountMetas(accounts);

  return [...accountMetas, ...otherMetas];
}
