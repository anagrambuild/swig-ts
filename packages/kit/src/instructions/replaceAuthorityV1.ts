import {
  AccountRole,
  type Address,
  type ReadonlyAccount,
  type ReadonlySignerAccount,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type ReplaceAuthorityV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type ReplaceAuthorityV1BaseAccountMetas = [
  WritableAccount,
  WritableSignerAccount,
  ReadonlyAccount<typeof SYSTEM_PROGRAM_ADDRESS>,
];

export function getReplaceAuthorityV1BaseAccountMetas(
  accounts: ReplaceAuthorityV1InstructionAccounts,
): ReplaceAuthorityV1BaseAccountMetas {
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

export type ReplaceAuthorityV1BaseAccountMetasWithAuthority = [
  ...ReplaceAuthorityV1BaseAccountMetas,
  ReadonlySignerAccount,
];

export function getReplaceV1BaseAccountMetasWithAuthority(
  accounts: ReplaceAuthorityV1InstructionAccounts,
  authority: Address,
): [ReplaceAuthorityV1BaseAccountMetasWithAuthority, number] {
  let accountMetas = getReplaceAuthorityV1BaseAccountMetas(accounts);
  let authorityIndex = accountMetas.length;

  let metas: ReplaceAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}
