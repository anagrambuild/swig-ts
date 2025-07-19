import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SignV1InstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type SignV1BaseAccountMetas = [SolAccountMeta, SolAccountMeta];

export function getSignV1BaseAccountMetas(
  accounts: SignV1InstructionAccounts,
): SignV1BaseAccountMetas {
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
  ];
}

export type SignV1BaseAccountMetasWithAuthority = [
  ...SignV1BaseAccountMetas,
  SolAccountMeta,
];

export function getSignV1BaseAccountMetasWithAuthority(
  accounts: SignV1InstructionAccounts,
  authority: SolPublicKeyData,
): [SignV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSignV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SignV1BaseAccountMetasWithAuthority = [
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

export type SignV1BaseAccountMetasWithSystemProgram = [
  ...SignV1BaseAccountMetas,
  SolAccountMeta,
  ...SolAccountMeta[],
];

export function getSignV1BaseAccountMetasWithSystemProgram(
  accounts: SignV1InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): SignV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSignV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    SolAccountMeta.from({
      pubkey: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING),
      isSigner: false,
      isWritable: false,
    }),
    ...otherMetas,
  ];
}
