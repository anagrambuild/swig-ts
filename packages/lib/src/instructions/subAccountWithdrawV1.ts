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
  SolAccountMeta, // swig
  SolAccountMeta, // payer
  SolAccountMeta, // subAccount
];

export type SubAccountWithdrawV1SolAccountMetas = [
  SolAccountMeta, // swig
  SolAccountMeta, // payer
  SolAccountMeta, // subAccount
  SolAccountMeta, // swigSystemAddress
  SolAccountMeta, // system_program
];

export type SubAccountWithdrawV1TokenAccountMetas = [
  ...SubAccountWithdrawV1SolAccountMetas,
  SolAccountMeta, // subAccountToken
  SolAccountMeta, // swigToken
  SolAccountMeta, // tokenProgram
];

export function getSubAccountWithdrawV1SolAccountMetas(
  accounts: SubAccountWithdrawV1SolInstructionAccounts,
): SubAccountWithdrawV1SolAccountMetas {
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
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
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
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigSystemAddress).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccountToken).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigToken).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.tokenProgram).toAddress(),
      role: AccountRole.READONLY,
    }),
  ];
}

export function getSubAccountWithdrawV1AccountMetasWithAuthorityContext<
  T extends SolAccountMeta[],
>(
  accountMetas: T,
  authorityContext?: SolAccountMeta,
): [
  [
    ...SubAccountWithdrawV1BaseAccountMetas,
    SolAccountMeta,
    ...SolAccountMeta[],
  ],
  number,
] {
  const authorityContextIndex = 3;

  const authorityContextMeta =
    authorityContext ??
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
    });

  return [
    [
      ...accountMetas.slice(0, authorityContextIndex),
      authorityContextMeta,
      ...accountMetas.slice(authorityContextIndex),
    ] as [
      ...SubAccountWithdrawV1BaseAccountMetas,
      SolAccountMeta,
      ...SolAccountMeta[],
    ],
    authorityContextIndex,
  ];
}
