import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type CreateSessionV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type CreateSessionV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getCreateSessionV1BaseAccountMetas(
  accounts: CreateSessionV1InstructionAccounts,
): CreateSessionV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.READONLY },
    { address: accounts.payer, role: AccountRole.READONLY_SIGNER },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] createSessionV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] createSessionV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return metas as [(typeof metas)[0], (typeof metas)[1]];
}

export type CreateSessionV1BaseAccountMetasWithAuthority = [
  ...CreateSessionV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getCreateSessionV1BaseAccountMetasWithAuthority(
  accounts: CreateSessionV1InstructionAccounts,
  authority: Address,
): [CreateSessionV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getCreateSessionV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: CreateSessionV1BaseAccountMetasWithAuthority = [
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
        '[kit][FATAL] createSessionV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] createSessionV1.ts: meta.address is undefined: ' +
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

export type CreateSessionV1BaseAccountMetasWithSystemProgram = [
  ...CreateSessionV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getCreateSessionV1BaseAccountMetasWithSystemProgram(
  accounts: CreateSessionV1InstructionAccounts,
): CreateSessionV1BaseAccountMetasWithSystemProgram {
  const accountMetas = getCreateSessionV1BaseAccountMetas(accounts);

  return [
    ...accountMetas,
    {
      address: SYSTEM_PROGRAM_ADDRESS,
      role: AccountRole.READONLY,
    },
  ];
}
