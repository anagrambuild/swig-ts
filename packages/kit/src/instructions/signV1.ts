import {
  AccountRole,
  type Address,
  type ReadonlySignerAccount,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/kit';

export type SignV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type SignV1InstructionAccountsWithAuthority = {
  swig: Address;
  payer: Address;
  authority: Address;
};

export type SignV1BaseAccountMetas = [WritableAccount, WritableSignerAccount];

export function getSignV1BaseAccountMetas(
  accounts: SignV1InstructionAccounts,
): SignV1BaseAccountMetas {
  return [
    {
      address: accounts.swig,
      role: AccountRole.WRITABLE,
    },
    {
      address: accounts.payer,
      role: AccountRole.WRITABLE_SIGNER,
    },
  ];
}

export type SignV1BaseAccountMetasWithAuthority = [
  ...SignV1BaseAccountMetas,
  ReadonlySignerAccount,
];

export function getSignV1BaseAccountMetasWithAuthority(
  accounts: SignV1InstructionAccounts,
  authority: Address,
): [SignV1BaseAccountMetasWithAuthority, number] {
  let accountMetas = getSignV1BaseAccountMetas(accounts);
  let authorityIndex = accountMetas.length;

  let metas: SignV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}
