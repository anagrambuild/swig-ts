import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SubAccountWithdrawV1BaseInstructionAccounts = {
  swig: SolPublicKeyData;
  payer: SolPublicKeyData;
  subAccount: SolPublicKeyData;
  swigSystemAddress: SolPublicKeyData;
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
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.READONLY_SIGNER,
      // isSigner: true,
      // isWritable: false,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
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
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.READONLY_SIGNER,
      // isSigner: true,
      // isWritable: false,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
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
  const authorityIndex = accountMetas.length - 1;

  const metas = [
    ...accountMetas.slice(0, authorityIndex),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
    ...accountMetas.slice(authorityIndex),
  ] as SubAccountWithdrawV1SolAccountMetasWithAuthority;
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
  SubAccountWithdrawV1TokenAccountMetas[6],
];

export function getSubAccountWithdrawV1TokenAccountMetasWithAuthority(
  accounts: SubAccountWithdrawV1TokenInstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountWithdrawV1TokenAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
  const authorityIndex = accountMetas.length - 1;

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
    accountMetas[3], // swig system address
    accountMetas[4], // swig sub-account token
    accountMetas[5], // swig token
    accountMetas[6], // token program
  ];
  return [metas, authorityIndex];
}

export type SubAccountWithdrawV1AccountMetasWithSystemProgram = [
  ...SubAccountWithdrawV1BaseAccountMetas,
  ...SolAccountMeta[],
];

export function getSubAccountWithdrawV1AccountMetasWithSystemProgram(
  accountMetas: SolAccountMeta[],
  index: number,
  otherMetas: SolAccountMeta[] = [],
): SubAccountWithdrawV1AccountMetasWithSystemProgram {
  const systemProgramMeta = SolAccountMeta.fromKitAccountMeta({
    address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
    role: AccountRole.READONLY,
  });

  return [
    ...accountMetas.slice(0, index),
    systemProgramMeta,
    ...accountMetas.slice(index),
    ...otherMetas,
  ] as SubAccountWithdrawV1AccountMetasWithSystemProgram;
}
