import {
  AccountRole,
  type Address,
  type ReadonlyAccount,
  type ReadonlySignerAccount,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type RemoveAuthorityV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type RemoveAuthorityV1BaseAccountMetas = [
  WritableAccount,
  WritableSignerAccount,
  ReadonlyAccount<typeof SYSTEM_PROGRAM_ADDRESS>,
];

export function getRemoveAuthorityV1BaseAccountMetas(
  accounts: RemoveAuthorityV1InstructionAccounts,
): RemoveAuthorityV1BaseAccountMetas {
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

export type RemoveAuthorityV1BaseAccountMetasWithAuthority = [
  ...RemoveAuthorityV1BaseAccountMetas,
  ReadonlySignerAccount,
];

export function getRemoveV1BaseAccountMetasWithAuthority(
  accounts: RemoveAuthorityV1InstructionAccounts,
  authority: Address,
): [RemoveAuthorityV1BaseAccountMetasWithAuthority, number] {
  let accountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);
  let authorityIndex = accountMetas.length;

  let metas: RemoveAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}
