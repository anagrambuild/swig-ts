import { AccountRole } from '@solana/kit';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SubAccountWithdrawV1BaseInstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
  subAccount: SolPublicKeyData;
};

export type SubAccountWithdrawV1SolInstructionAccounts =
  SubAccountWithdrawV1BaseInstructionAccounts;

export type SubAccountWithdrawV1TokenInstructionAccounts =
  SubAccountWithdrawV1BaseInstructionAccounts & {
    subAccountToken: SolPublicKeyData;
    swigToken: SolPublicKeyData;
    tokenProgram: SolPublicKeyData;
  };

export type SubAccountWithdrawV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export type SubAccountWithdrawV1SolAccountMetas =
  SubAccountWithdrawV1BaseAccountMetas;

export type SubAccountWithdrawV1TokenAccountMetas = [
  ...SubAccountWithdrawV1BaseAccountMetas,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getSubAccountWithdrawV1SolAccountMetas(
  accounts: SubAccountWithdrawV1SolInstructionAccounts,
): SubAccountWithdrawV1SolAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.READONLY,
      // isSigner: false,
      // isWritable: false,
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
  ];
}

export function getSubAccountWithdrawV1TokenAccountMetas(
  accounts: SubAccountWithdrawV1TokenInstructionAccounts,
): SubAccountWithdrawV1TokenAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.READONLY,
      // isSigner: false,
      // isWritable: false,
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
      address: new SolPublicKey(accounts.subAccountToken).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigToken).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.tokenProgram).toAddress(),
      role: AccountRole.READONLY,
      // isSigner: false,
      // isWritable: false,
    }),
  ];
}

export type SubAccountWithdrawV1SolAccountMetasWithAuthority = [
  ...SubAccountWithdrawV1SolAccountMetas,
  SolAccountMeta,
];

export function getSubAccountWithdrawV1SolAccountMetasWithAuthority(
  accounts: SubAccountWithdrawV1SolInstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountWithdrawV1SolAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountWithdrawV1SolAccountMetasWithAuthority = [
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

export type SubAccountWithdrawV1TokenAccountMetasWithAuthority = [
  SubAccountWithdrawV1TokenAccountMetas[0],
  SubAccountWithdrawV1TokenAccountMetas[1],
  SubAccountWithdrawV1TokenAccountMetas[2],
  SolAccountMeta,
  SubAccountWithdrawV1TokenAccountMetas[3],
  SubAccountWithdrawV1TokenAccountMetas[4],
  SubAccountWithdrawV1TokenAccountMetas[5],
];

export function getSubAccountWithdrawV1TokenAccountMetasWithAuthority(
  accounts: SubAccountWithdrawV1TokenInstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountWithdrawV1TokenAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountWithdrawV1TokenAccountMetasWithAuthority = [
    accountMetas[0], // swig
    accountMetas[1], // payer
    accountMetas[2], // sub-account
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
      // isSigner: true,
      // isWritable: false,
    }),
    accountMetas[3], // swig sub-account token
    accountMetas[4], // swig token
    accountMetas[5], // token program
  ];
  return [metas, authorityIndex];
}
