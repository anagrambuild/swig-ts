import {
  SystemProgram,
  type AccountMeta,
  type PublicKey,
} from '@solana/web3.js';

export type SubAccountSignV1InstructionAccounts = {
  swig: PublicKey;
  payer: PublicKey;
  subAccount: PublicKey;
};

export type SubAccountSignV1BaseAccountMetas = [
  AccountMeta,
  AccountMeta,
  AccountMeta,
  AccountMeta,
];

export function getSubAccountSignV1BaseAccountMetas(
  accounts: SubAccountSignV1InstructionAccounts,
): SubAccountSignV1BaseAccountMetas {
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
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];
}

export type SubAccountSignV1BaseAccountMetasWithAuthority = [
  ...SubAccountSignV1BaseAccountMetas,
  AccountMeta,
];

export function getSubAccountSignV1BaseAccountMetasWithAuthority(
  accounts: SubAccountSignV1InstructionAccounts,
  authority: PublicKey,
): [SubAccountSignV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountSignV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountSignV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    },
  ];
  return [metas, authorityIndex];
}

export type SubAccountSignV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountSignV1BaseAccountMetas,
  AccountMeta,
];

export function getSubAccountSignV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountSignV1InstructionAccounts,
): SubAccountSignV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountSignV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];
}
