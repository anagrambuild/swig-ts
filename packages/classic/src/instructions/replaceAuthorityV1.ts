import {
  SystemProgram,
  type AccountMeta,
  type PublicKey,
} from '@solana/web3.js';

export type ReplaceAuthorityV1InstructionAccounts = {
  swig: PublicKey;
  payer: PublicKey;
};

export type ReplaceAuthorityV1BaseAccountMetas = [
  AccountMeta,
  AccountMeta,
  AccountMeta,
];

export function getReplaceAuthorityV1BaseAccountMetas(
  accounts: ReplaceAuthorityV1InstructionAccounts,
): ReplaceAuthorityV1BaseAccountMetas {
  return [
    {
      pubkey: accounts.swig,
      // role: AccountRole.WRITABLE,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: accounts.payer,
      // role: AccountRole.WRITABLE_SIGNER,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      // role: AccountRole.READONLY,
      isSigner: false,
      isWritable: false,
    },
  ];
}

export type ReplaceAuthorityV1BaseAccountMetasWithAuthority = [
  ...ReplaceAuthorityV1BaseAccountMetas,
  AccountMeta,
];

export function getReplaceV1BaseAccountMetasWithAuthority(
  accounts: ReplaceAuthorityV1InstructionAccounts,
  authority: PublicKey,
): [ReplaceAuthorityV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getReplaceAuthorityV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: ReplaceAuthorityV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    {
      pubkey: authority,
      // role: AccountRole.READONLY_SIGNER,
      isSigner: true,
      isWritable: false,
    },
  ];
  return [metas, authorityIndex];
}
