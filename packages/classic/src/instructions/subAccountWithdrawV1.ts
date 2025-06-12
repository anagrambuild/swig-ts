import { type AccountMeta, type PublicKey } from '@solana/web3.js';

export type SubAccountWithdrawV1BaseInstructionAccounts = {
  swig: PublicKey;
  payer: PublicKey;
  subAccount: PublicKey;
};

export type SubAccountWithdrawV1SolInstructionAccounts =
  SubAccountWithdrawV1BaseInstructionAccounts;

export type SubAccountWithdrawV1TokenInstructionAccounts =
  SubAccountWithdrawV1BaseInstructionAccounts & {
    subAccountToken: PublicKey;
    swigToken: PublicKey;
    tokenProgram: PublicKey;
  };

export type SubAccountWithdrawV1BaseAccountMetas = [
  AccountMeta,
  AccountMeta,
  AccountMeta,
];

export type SubAccountWithdrawV1SolAccountMetas =
  SubAccountWithdrawV1BaseAccountMetas;

export type SubAccountWithdrawV1TokenAccountMetas = [
  ...SubAccountWithdrawV1BaseAccountMetas,
  AccountMeta,
  AccountMeta,
  AccountMeta,
];

export function getSubAccountWithdrawV1SolAccountMetas(
  accounts: SubAccountWithdrawV1SolInstructionAccounts,
): SubAccountWithdrawV1SolAccountMetas {
  return [
    {
      pubkey: accounts.swig,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: accounts.payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: accounts.subAccount,
      isSigner: false,
      isWritable: true,
    },
  ];
}

export function getSubAccountWithdrawV1TokenAccountMetas(
  accounts: SubAccountWithdrawV1TokenInstructionAccounts,
): SubAccountWithdrawV1TokenAccountMetas {
  return [
    {
      pubkey: accounts.swig,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: accounts.payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: accounts.subAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: accounts.subAccountToken,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: accounts.swigToken,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: accounts.tokenProgram,
      isSigner: false,
      isWritable: false,
    },
  ];
}

export type SubAccountWithdrawV1SolAccountMetasWithAuthority = [
  ...SubAccountWithdrawV1SolAccountMetas,
  AccountMeta,
];

export function getSubAccountWithdrawV1SolAccountMetasWithAuthority(
  accounts: SubAccountWithdrawV1SolInstructionAccounts,
  authority: PublicKey,
): [SubAccountWithdrawV1SolAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountWithdrawV1SolAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountWithdrawV1SolAccountMetasWithAuthority = [
    ...accountMetas,
    {
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    },
  ];
  return [metas, authorityIndex];
}

export type SubAccountWithdrawV1TokenAccountMetasWithAuthority = [
  ...SubAccountWithdrawV1TokenAccountMetas,
  AccountMeta,
];

export function getSubAccountWithdrawV1TokenAccountMetasWithAuthority(
  accounts: SubAccountWithdrawV1TokenInstructionAccounts,
  authority: PublicKey,
): [SubAccountWithdrawV1TokenAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountWithdrawV1TokenAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountWithdrawV1TokenAccountMetasWithAuthority = [
    accountMetas[0], // swig
    accountMetas[1], // payer
    accountMetas[2], // sub-account
    {
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    },
    accountMetas[3], // swig sub-account token
    accountMetas[4], // swig token
    accountMetas[5], // token program
  ];
  return [metas, authorityIndex];
}
