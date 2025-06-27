import { AccountRole, type Address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../consts';

export type CreateV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type CreateV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getCreateV1BaseAccountMetas(
  accounts: CreateV1InstructionAccounts,
): CreateV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.WRITABLE },
    { address: accounts.payer, role: AccountRole.WRITABLE_SIGNER },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] createV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] createV1.ts: meta.address is undefined: ' +
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
