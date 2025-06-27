import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type SubAccountToggleV1InstructionAccounts = {
  swig: Address;
  payer: Address;
  subAccount: Address;
};

export type SubAccountToggleV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getSubAccountToggleV1BaseAccountMetas(
  accounts: SubAccountToggleV1InstructionAccounts,
): SubAccountToggleV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.READONLY },
    { address: accounts.payer, role: AccountRole.READONLY_SIGNER },
    { address: accounts.subAccount, role: AccountRole.WRITABLE },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] subAccountToggleV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] subAccountToggleV1.ts: meta.address is undefined: ' +
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

export type SubAccountToggleV1BaseAccountMetasWithAuthority = [
  ...SubAccountToggleV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSubAccountToggleV1BaseAccountMetasWithAuthority(
  accounts: SubAccountToggleV1InstructionAccounts,
  authority: Address,
): [SubAccountToggleV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountToggleV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER,
    },
  ];
  return [metas, authorityIndex];
}

export type SubAccountToggleV1BaseAccountMetasWithSystemProgram = [
  ...SubAccountToggleV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSubAccountToggleV1BaseAccountMetasWithSystemProgram(
  accounts: SubAccountToggleV1InstructionAccounts,
): SubAccountToggleV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getSubAccountToggleV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      address: SYSTEM_PROGRAM_ADDRESS,
      role: AccountRole.READONLY,
    },
  ];
}
