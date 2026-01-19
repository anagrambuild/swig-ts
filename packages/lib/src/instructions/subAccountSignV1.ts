import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SubAccountSignV1InstructionAccounts = {
  swig: SolPublicKeyData;
  subAccount: SolPublicKeyData;
};

export type SubAccountSignV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getSubAccountSignV1BaseAccountMetas(
  accounts: SubAccountSignV1InstructionAccounts,
): SubAccountSignV1BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
    }),
  ];
}

export type SubAccountSignV1BaseAccountMetasWithAuthority = [
  ...SubAccountSignV1BaseAccountMetas,
  SolAccountMeta,
];

export function getSubAccountSignV1BaseAccountMetasWithAuthority(
  accounts: SubAccountSignV1InstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountSignV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountSignV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountSignV1BaseAccountMetasWithAuthority = [
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

export type SubAccountSignV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountSignV1BaseAccountMetas,
  // SolAccountMeta,
  ...SolAccountMeta[],
];

export function getSubAccountSignV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountSignV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): SubAccountSignV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountSignV1BaseAccountMetas(accounts);

  return [...accountMetas, ...otherMetas];
}
