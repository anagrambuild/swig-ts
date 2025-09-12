import { AccountRole, address } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type SubAccountSignV2InstructionAccounts = {
  swig: SolPublicKeyData;
  swigWalletAddress: SolPublicKeyData;
  payer: SolPublicKeyData;
  subAccount: SolPublicKeyData;
};

export type SubAccountSignV2BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getSubAccountSignV2BaseAccountMetas(
  accounts: SubAccountSignV2InstructionAccounts,
): SubAccountSignV2BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.READONLY,
      // isSigner: false,
      // isWritable: false,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigWalletAddress).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: false,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.READONLY_SIGNER,
      // isSigner: true,
      // isWritable: false,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.subAccount).toAddress(),
      role: AccountRole.WRITABLE,
      // isSigner: false,
      // isWritable: true,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: address(SYSTEM_PROGRAM_ADDRESS_STRING),
      role: AccountRole.READONLY,
      // isSigner: false,
      // isWritable: false,
    }),
  ];
}

export type SubAccountSignV2BaseAccountMetasWithAuthority = [
  ...SubAccountSignV2BaseAccountMetas,
  SolAccountMeta,
];

export function getSubAccountSignV2BaseAccountMetasWithAuthority(
  accounts: SubAccountSignV2InstructionAccounts,
  authority: SolPublicKeyData,
): [SubAccountSignV2BaseAccountMetasWithAuthority, number] {
  const accountMetas = getSubAccountSignV2BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: SubAccountSignV2BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
      // isSigner: true,
      // isWritable: false,
    }),
  ];
  return [metas, authorityIndex];
}

// export type SubAccountSignV2BaseAccountMetasWithSystemProgram = [
//   ...SubAccountSignV2BaseAccountMetas,
//   AccountMeta,
// ];

// export function getSubAccountSignV2BaseAccountMetasWithSystemProgram(
//   accounts: SubAccountSignV2InstructionAccounts,
// ): SubAccountSignV2BaseAccountMetasWithSystemProgram {
//   const accountMetas = getSubAccountSignV2BaseAccountMetas(accounts);

//   return [
//     ...accountMetas,
//     {
//       pubkey: SystemProgram.programId,
//       isSigner: false,
//       isWritable: false,
//     },
//   ];
// }
