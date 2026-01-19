import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SubAccountCreateV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
  subAccount: SolPublicKeyData;
};

export type SubAccountCreateV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getSubAccountCreateV1BaseAccountMetas(
  accounts: SubAccountCreateV1InstructionAccounts,
): SubAccountCreateV1BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
      // isSigner: true,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
      // isSigner: false,
      // isWritable: false,
    }),
  ];
}

export type SubAccountCreateV1BaseAccountMetasWithAuthority = [
  ...SubAccountCreateV1BaseAccountMetas,
  SolAccountMeta,
];

export function getSubAccountCreateV1BaseAccountMetasWithAuthority(
  accounts: SubAccountCreateV1InstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountCreateV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountCreateV1BaseAccountMetasWithAuthority = [
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

export type SubAccountCreateV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountCreateV1BaseAccountMetas,
  // SolAccountMeta,
  ...SolAccountMeta[],
];

export function getSubAccountCreateV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountCreateV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): SubAccountCreateV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);

  return [...accountMetas, ...otherMetas];
}
