import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SubAccountToggleV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
  subAccount: SolPublicKeyData;
};

export type SubAccountToggleV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getSubAccountToggleV1BaseAccountMetas(
  accounts: SubAccountToggleV1InstructionAccounts,
): SubAccountToggleV1BaseAccountMetas {
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
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
    }),
  ];
}

export type SubAccountToggleV1BaseAccountMetasWithAuthority = [
  ...SubAccountToggleV1BaseAccountMetas,
  SolAccountMeta,
];

export function getSubAccountToggleV1BaseAccountMetasWithAuthority(
  accounts: SubAccountToggleV1InstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountToggleV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountToggleV1BaseAccountMetasWithAuthority = [
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

export type SubAccountToggleV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountToggleV1BaseAccountMetas,
  SolAccountMeta,
  ...SolAccountMeta[],
];

export function getSubAccountToggleV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountToggleV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): SubAccountToggleV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
    }),
    ...otherMetas,
  ];
}
