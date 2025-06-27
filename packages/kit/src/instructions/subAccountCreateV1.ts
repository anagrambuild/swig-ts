import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type SubAccountCreateV1InstructionAccounts = {
  swig: Address;
  payer: Address;
  subAccount: Address;
};

export type SubAccountCreateV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getSubAccountCreateV1BaseAccountMetas(
  accounts: SubAccountCreateV1InstructionAccounts,
): SubAccountCreateV1BaseAccountMetas {
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
        '[kit][FATAL] subAccountCreateV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] subAccountCreateV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return metas as SubAccountCreateV1BaseAccountMetas;
}

export type SubAccountCreateV1BaseAccountMetasWithAuthority = [
  ...SubAccountCreateV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSubAccountCreateV1BaseAccountMetasWithAuthority(
  accounts: SubAccountCreateV1InstructionAccounts,
  authority: Address,
): [SubAccountCreateV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountCreateV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] subAccountCreateV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] subAccountCreateV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return [metas, authorityIndex];
}

export type SubAccountCreateV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountCreateV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSubAccountCreateV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountCreateV1InstructionAccounts,
): SubAccountCreateV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountCreateV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      address: SYSTEM_PROGRAM_ADDRESS,
      role: AccountRole.READONLY,
    },
  ];
}
