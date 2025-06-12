import {
  AccountRole,
  type Address,
  type ReadonlyAccount,
  type ReadonlySignerAccount,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type AddAuthorityV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type AddAuthorityV1BaseAccountMetas = [
  WritableAccount,
  WritableSignerAccount,
  ReadonlyAccount<typeof SYSTEM_PROGRAM_ADDRESS>,
];

export function getAddAuthorityV1BaseAccountMetas(
  accounts: AddAuthorityV1InstructionAccounts,
): AddAuthorityV1BaseAccountMetas {
  return [
    {
      address: accounts.swig,
      role: AccountRole.WRITABLE,
    },
    {
      address: accounts.payer,
      role: AccountRole.WRITABLE_SIGNER,
    },
    {
      address: SYSTEM_PROGRAM_ADDRESS,
      role: AccountRole.READONLY,
    },
  ];
}

export type AddAuthorityV1BaseAccountMetasWithAuthority = [
  ...AddAuthorityV1BaseAccountMetas,
  ReadonlySignerAccount,
];

export function getAddV1BaseAccountMetasWithAuthority(
  accounts: AddAuthorityV1InstructionAccounts,
  authority: Address,
): [AddAuthorityV1BaseAccountMetasWithAuthority, number] {
  let accountMetas = getAddAuthorityV1BaseAccountMetas(accounts);
  let authorityIndex = accountMetas.length;

  let metas: AddAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}
