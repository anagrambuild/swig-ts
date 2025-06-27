import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type ReplaceAuthorityV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type ReplaceAuthorityV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getReplaceAuthorityV1BaseAccountMetas(
  accounts: ReplaceAuthorityV1InstructionAccounts,
): ReplaceAuthorityV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.READONLY },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    { address: accounts.payer, role: AccountRole.READONLY_SIGNER },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] replaceAuthorityV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] replaceAuthorityV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return metas as ReplaceAuthorityV1BaseAccountMetas;
}

export type ReplaceAuthorityV1BaseAccountMetasWithAuthority = [
  ...ReplaceAuthorityV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getReplaceV1BaseAccountMetasWithAuthority(
  accounts: ReplaceAuthorityV1InstructionAccounts,
  authority: Address,
): [ReplaceAuthorityV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getReplaceAuthorityV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: ReplaceAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}
