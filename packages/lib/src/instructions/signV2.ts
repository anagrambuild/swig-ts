import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SignV2InstructionAccounts = {
  swig: SolPublicKeyData;
  swigWalletAddress: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type SignV2BaseAccountMetas = [SolAccountMeta, SolAccountMeta, SolAccountMeta];

export function getSignV2BaseAccountMetas(
  accounts: SignV2InstructionAccounts,
): SignV2BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
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

export type SignV2BaseAccountMetasWithAuthority = [
  ...SignV2BaseAccountMetas,
  SolAccountMeta,
];

export function getSignV2BaseAccountMetasWithAuthority(
  accounts: SignV2InstructionAccounts,
  authority: SolPublicKeyData,
): [SignV2BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSignV2BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SignV2BaseAccountMetasWithAuthority = [
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

export type SignV2BaseAccountMetasWithSystemProgram = [
  ...SignV2BaseAccountMetas,
  SolAccountMeta,
  ...SolAccountMeta[],
];

export function getSignV2BaseAccountMetasWithSystemProgram(
  accounts: SignV2InstructionAccounts,
  otherMetas: SolAccountMeta[] = [],
): SignV2BaseAccountMetasWithSystemProgram {
  const accountMetas = getSignV2BaseAccountMetas(accounts);

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
