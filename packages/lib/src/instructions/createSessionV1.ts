import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type CreateSessionV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type CreateSessionV1BaseAccountMetas = [SolAccountMeta, SolAccountMeta];

export function getCreateSessionV1BaseAccountMetas(
  accounts: CreateSessionV1InstructionAccounts,
): CreateSessionV1BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
    }),
  ];
}

export type CreateSessionV1BaseAccountMetasWithAuthority = [
  ...CreateSessionV1BaseAccountMetas,
  SolAccountMeta,
];

export function getCreateSessionV1BaseAccountMetasWithAuthority(
  accounts: CreateSessionV1InstructionAccounts,
  authority: SolPublicKeyData,
): [CreateSessionV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getCreateSessionV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: CreateSessionV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}

export type CreateSessionV1BaseAccountMetasWithSystemProgram = [
  ...CreateSessionV1BaseAccountMetas,
  SolAccountMeta,
  ...SolAccountMeta[],
];

export function getCreateSessionV1BaseAccountMetasWithSystemProgram(
  accounts: CreateSessionV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): CreateSessionV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getCreateSessionV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
    }),
    ...otherMetas,
  ];
}
