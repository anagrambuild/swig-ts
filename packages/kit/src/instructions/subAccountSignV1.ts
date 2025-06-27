import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type SubAccountSignV1InstructionAccounts = {
  swig: Address;
  payer: Address;
  subAccount: Address;
};

export type SubAccountSignV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getSubAccountSignV1BaseAccountMetas(
  accounts: SubAccountSignV1InstructionAccounts,
): SubAccountSignV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.READONLY },
    { address: accounts.payer, role: AccountRole.READONLY_SIGNER },
    { address: accounts.subAccount, role: AccountRole.WRITABLE },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] subAccountSignV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] subAccountSignV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return metas as SubAccountSignV1BaseAccountMetas;
}

export type SubAccountSignV1BaseAccountMetasWithAuthority = [
  ...SubAccountSignV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSubAccountSignV1BaseAccountMetasWithAuthority(
  accounts: SubAccountSignV1InstructionAccounts,
  authority: Address,
): [SubAccountSignV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountSignV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountSignV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}

export type SubAccountSignV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountSignV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSubAccountSignV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountSignV1InstructionAccounts,
): SubAccountSignV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountSignV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      address: SYSTEM_PROGRAM_ADDRESS,
      role: AccountRole.READONLY,
    },
  ];
}
