import { AccountRole, type Address } from '@solana/kit';

export type SignV1InstructionAccounts = {
  swig: Address;
  payer: Address;
};

export type SignV1BaseAccountMetas = [
  { address: Address; role: AccountRole },
  { address: Address; role: AccountRole },
];

export function getSignV1BaseAccountMetas(
  accounts: SignV1InstructionAccounts,
): SignV1BaseAccountMetas {
  const metas = [
    { address: accounts.swig, role: AccountRole.READONLY },
    { address: accounts.payer, role: AccountRole.WRITABLE_SIGNER },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] signV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] signV1.ts: meta.address is undefined: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  return metas as SignV1BaseAccountMetas;
}

export type SignV1BaseAccountMetasWithAuthority = [
  ...SignV1BaseAccountMetas,
  { address: Address; role: AccountRole },
];

export function getSignV1BaseAccountMetasWithAuthority(
  accounts: SignV1InstructionAccounts,
  authority: Address,
): [SignV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSignV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SignV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      address: authority,
      role: AccountRole.READONLY_SIGNER, // isSigner: true, isWritable: false
    },
  ];
  metas.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] signV1.ts: meta.address is undefined:',
        meta,
        'at index',
        i,
        'accounts:',
        accounts,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] signV1.ts: meta.address is undefined: ' +
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
