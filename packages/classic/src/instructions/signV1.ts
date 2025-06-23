import {
  SystemProgram,
  type AccountMeta,
  type PublicKey,
} from '@solana/web3.js';

export type SignV1InstructionAccounts = {
  swig: PublicKey;
  payer: PublicKey;
};

export type SignV1BaseAccountMetas = [AccountMeta, AccountMeta];

export function getSignV1BaseAccountMetas(
  accounts: SignV1InstructionAccounts,
): SignV1BaseAccountMetas {
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
  ];
}

export type SignV1BaseAccountMetasWithAuthority = [
  ...SignV1BaseAccountMetas,
  AccountMeta,
];

export function getSignV1BaseAccountMetasWithAuthority(
  accounts: SignV1InstructionAccounts,
  authority: PublicKey,
): [SignV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSignV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SignV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    },
  ];
  return [metas, authorityIndex];
}

export type SignV1BaseAccountMetasWithSystemProgram = [
  ...SignV1BaseAccountMetas,
  AccountMeta,
  ...AccountMeta[],
];

export function getSignV1BaseAccountMetasWithSystemProgram(
  accounts: SignV1InstructionAccounts,
  otherMetas: AccountMeta[] = [],
): SignV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSignV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    ...otherMetas,
  ];
}
