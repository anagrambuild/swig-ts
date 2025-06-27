import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type RemoveAuthorityV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type RemoveAuthorityV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getRemoveAuthorityV1BaseAccountMetas(
  accounts: RemoveAuthorityV1InstructionAccounts,
): RemoveAuthorityV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.WRITABLE },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    { address: accounts.payer, role: AccountRole.WRITABLE_SIGNER },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] removeAuthorityV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] removeAuthorityV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return metas as [(typeof metas)[0], (typeof metas)[1], (typeof metas)[2]];
}

export type RemoveAuthorityV1BaseAccountMetasWithAuthority = [
  ...RemoveAuthorityV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getRemoveV1BaseAccountMetasWithAuthority(
  accounts: RemoveAuthorityV1InstructionAccounts,
  authority: Address,
): [RemoveAuthorityV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getRemoveAuthorityV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: RemoveAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}
