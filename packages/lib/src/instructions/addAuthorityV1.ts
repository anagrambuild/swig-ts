import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type AddAuthorityV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type AddAuthorityV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getAddAuthorityV1BaseAccountMetas(
  accounts: AddAuthorityV1InstructionAccounts,
): AddAuthorityV1BaseAccountMetas {
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

export type AddAuthorityV1BaseAccountMetasWithAuthority = [
  ...AddAuthorityV1BaseAccountMetas,
  SolAccountMeta,
];

export function getAddV1BaseAccountMetasWithAuthority(
  accounts: AddAuthorityV1InstructionAccounts,
  authority: SolPublicKeyData,
): [AddAuthorityV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getAddAuthorityV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: AddAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}

export type AddAuthorityV1BaseAccountMetasWithSystemProgram = [
  ...AddAuthorityV1BaseAccountMetas,
  // SolAccountMeta,
  ...SolAccountMeta[],
];

export function getAddAuthorityV1BaseAccountMetasWithSystemProgram(
  accounts: AddAuthorityV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): AddAuthorityV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getAddAuthorityV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    // SolAccountMeta.from({
    //   pubkey: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING),
    //   isSigner: false,
    //   isWritable: false,
    // }),
    ...otherMetas,
  ];
}
