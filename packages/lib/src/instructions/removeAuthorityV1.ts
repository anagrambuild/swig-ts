import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type RemoveAuthorityV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type RemoveAuthorityV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getRemoveAuthorityV1BaseAccountMetas(
  accounts: RemoveAuthorityV1InstructionAccounts,
): RemoveAuthorityV1BaseAccountMetas {
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

export type RemoveAuthorityV1BaseAccountMetasWithAuthority = [
  ...RemoveAuthorityV1BaseAccountMetas,
  SolAccountMeta,
];

export function getRemoveV1BaseAccountMetasWithAuthority(
  accounts: RemoveAuthorityV1InstructionAccounts,
  authority: SolPublicKeyData,
): [RemoveAuthorityV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: RemoveAuthorityV1BaseAccountMetasWithAuthority = [
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

export type RemoveAuthorityV1BaseAccountMetasWithSystemProgram = [
  ...RemoveAuthorityV1BaseAccountMetas,
  // SolAccountMeta,
  ...SolAccountMeta[],
];

export function getRemoveAuthorityV1BaseAccountMetasWithSystemProgram(
  accounts: RemoveAuthorityV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): RemoveAuthorityV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);

  return [...accountMetas, ...otherMetas];
}
