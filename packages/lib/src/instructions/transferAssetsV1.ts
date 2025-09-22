import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import { SolAccountMeta, SolPublicKey, type SolPublicKeyData } from '../solana';

export type TransferAssetsV1InstructionAccounts = {
  swig: SolPublicKeyData;
  swigWalletAddress: SolPublicKeyData;
  payer: SolPublicKeyData;
};

export type TransferAssetsV1BaseAccountMetas = [
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
  SolAccountMeta,
];

export function getTransferAssetsV1BaseAccountMetas(
  accounts: TransferAssetsV1InstructionAccounts,
): TransferAssetsV1BaseAccountMetas {
  return [
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swig).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.swigWalletAddress).toAddress(),
      role: AccountRole.WRITABLE,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(accounts.payer).toAddress(),
      role: AccountRole.WRITABLE_SIGNER,
    }),
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING).toAddress(),
      role: AccountRole.READONLY,
    }),
  ];
}

export type TransferAssetsV1BaseAccountMetasWithAuthority = [
  ...TransferAssetsV1BaseAccountMetas,
  SolAccountMeta,
];

export function getTransferAssetsV1BaseAccountMetasWithAuthority(
  accounts: TransferAssetsV1InstructionAccounts,
  authority: SolPublicKeyData,
): [TransferAssetsV1BaseAccountMetasWithAuthority, number] {
  const accountMetas = getTransferAssetsV1BaseAccountMetas(accounts);
  const authorityIndex = accountMetas.length;

  const metas: TransferAssetsV1BaseAccountMetasWithAuthority = [
    ...accountMetas,
    SolAccountMeta.fromKitAccountMeta({
      address: new SolPublicKey(authority).toAddress(),
      role: AccountRole.READONLY_SIGNER,
    }),
  ];
  return [metas, authorityIndex];
}

// export type TransferAssetsV1BaseAccountMetasWithSystemProgram = [
//   ...TransferAssetsV1BaseAccountMetas,
//   SolAccountMeta,
//   ...SolAccountMeta[],
// ];

// export function getTransferAssetsV1BaseAccountMetasWithSystemProgram(
//   accounts: TransferAssetsV1InstructionAccounts,
//   otherMetas: SolAccountMeta[] = [],
// ): TransferAssetsV1BaseAccountMetasWithSystemProgram {
//   const accountMetas = getTransferAssetsV1BaseAccountMetas(accounts);

//   return [
//     ...accountMetas,
//     SolAccountMeta.from({
//       pubkey: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING),
//       isSigner: false,
//       isWritable: false,
//     }),
//     ...otherMetas,
//   ];
// }
