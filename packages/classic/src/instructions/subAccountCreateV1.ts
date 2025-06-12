import {
  SystemProgram,
  type AccountMeta,
  type PublicKey,
} from '@solana/web3.js';

export type SubAccountCreateV1InstructionAccounts = {
  swig: PublicKey;
  payer: PublicKey;
  subAccount: PublicKey;
};

export type SubAccountCreateV1BaseAccountMetas = [
  AccountMeta,
  AccountMeta,
  AccountMeta,
  AccountMeta,
];

export function getSubAccountCreateV1BaseAccountMetas(
  accounts: SubAccountCreateV1InstructionAccounts,
): SubAccountCreateV1BaseAccountMetas {
  return [
    {
      pubkey: accounts.swig,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: accounts.payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: accounts.subAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];
}

export type SubAccountCreateV1BaseAccountMetasWithAuthority = [
  ...SubAccountCreateV1BaseAccountMetas,
  AccountMeta,
];

export function getSubAccountCreateV1BaseAccountMetasWithAuthority(
  accounts: SubAccountCreateV1InstructionAccounts,
  authority: PublicKey,
): [SubAccountCreateV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountCreateV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    },
  ];
  return [metas, authorityIndex];
}

export type SubAccountCreateV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountCreateV1BaseAccountMetas,
  AccountMeta,
];

export function getSubAccountCreateV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountCreateV1InstructionAccounts,
): SubAccountCreateV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];
}
