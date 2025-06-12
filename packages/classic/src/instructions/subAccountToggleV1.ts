import {
  SystemProgram,
  type AccountMeta,
  type PublicKey,
} from '@solana/web3.js';

export type SubAccountToggleV1InstructionAccounts = {
  swig: PublicKey;
  payer: PublicKey;
  subAccount: PublicKey;
};

export type SubAccountToggleV1BaseAccountMetas = [
  AccountMeta,
  AccountMeta,
  AccountMeta,
];

export function getSubAccountToggleV1BaseAccountMetas(
  accounts: SubAccountToggleV1InstructionAccounts,
): SubAccountToggleV1BaseAccountMetas {
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

export type SubAccountToggleV1BaseAccountMetasWithAuthority = [
  ...SubAccountToggleV1BaseAccountMetas,
  AccountMeta,
];

export function getSubAccountToggleV1BaseAccountMetasWithAuthority(
  accounts: SubAccountToggleV1InstructionAccounts,
  authority: PublicKey,
): [SubAccountToggleV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountToggleV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    },
  ];
  return [metas, authorityIndex];
}

export type SubAccountToggleV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountToggleV1BaseAccountMetas,
  AccountMeta,
];

export function getSubAccountToggleV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountToggleV1InstructionAccounts,
): SubAccountToggleV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];
}
