// import { TransactionInstruction } from '@solana/web3.js';
// import {
//   action,
//   AuthorityType,
//   getSwigCodec,
//   tokenAction,
//   type Role,
//   type SwigAccount,
// } from '@swig-wallet/coder';
// import { describe, test } from 'bun:test';
// import assert from 'node:assert';
// import { readFileSync } from 'node:fs';
// import { Authority, Swig } from '../src';
// import { mockBytesArray, mockPublicKey, uint8ArraysEqual } from './utils';
// import { Ed25519Authority } from '../dist';

// describe('Schema tests', () => {
//   test('Swig account!', () => {
//     let swigSanityData = Uint8Array.from(
//       readFileSync('tests/sanity/data/swig.bin'),
//     );

//     let authority0 = new Ed25519Authority(mockPublicKey(0));
//     let authority1 = new Ed25519Authority(mockPublicKey(1));
//     let authority2 = new Ed25519Authority(mockPublicKey(2));

//     let roles: Role[] = [
//       {
//         size: 0n,
//         authorityData: authority0.data,
//         authorityType: AuthorityType.Ed25519,
//         startSlot: 0n,
//         endSlot: 0n,
//         actions: [
//           action('Token', {
//             key: Uint8Array.from(Array(32).fill(4)),
//             action: tokenAction('Manage', [100n]),
//           }),
//         ],
//       },
//       {
//         size: 0n,
//         authorityData: authority1.data,
//         authorityType: authority1.type,
//         startSlot: 0n,
//         endSlot: 0n,
//         actions: [action('All')],
//       },
//       {
//         size: 0n,
//         authorityData: authority2.data,
//         authorityType: authority2.type,
//         startSlot: 0n,
//         endSlot: 0n,
//         actions: [action('All')],
//       },
//     ];

//     roles[0].actions.push(
//       action('Token', {
//         key: mockBytesArray(0, 32),
//         action: tokenAction('Manage', [100n]),
//       }),
//     );
//     roles[1].actions.push(
//       action('Token', {
//         key: mockBytesArray(1, 32),
//         action: tokenAction('Manage', [100n]),
//       }),
//     );
//     roles[2].actions.push(
//       action('Token', {
//         key: mockBytesArray(2, 32),
//         action: tokenAction('Manage', [100n]),
//       }),
//     );

//     let swigAccount: SwigAccount = {
//       discriminator: 0,
//       id: Uint8Array.from(Array(13).fill(0)),
//       bump: 0,
//       roles,
//     };

//     let swigCodec = getSwigCodec();

//     let swigEncoded = swigCodec.encode(swigAccount);

//     let swigSanity = Swig.fromRawAccountData(mockPublicKey(3), swigSanityData);

//     let swigDecoded = Swig.fromRawAccountData(
//       mockPublicKey(3),
//       new Uint8Array(swigCodec.encode(swigAccount)),
//     );

//     assert(
//       swigSanity.findRoleByAuthority(authority0) !== null,
//       'could not find role by authority',
//     );

//     assert(
//       swigDecoded.findRoleByAuthority(authority0) !== null,
//       'could not find role by authority',
//     );

//     assert(uint8ArraysEqual(swigSanityData, Uint8Array.from(swigEncoded)));
//   });

//   test('CreateV1 instruction data!', () => {
//     let createInstructionData = Uint8Array.from(
//       readFileSync('tests/sanity/data/create.bin'),
//     );

//     let authorityAddress = mockPublicKey(2);

//     let authority = Authority.ed25519(authorityAddress);
//     let swigAccount = mockPublicKey(3);

//     let ix = authority.create({
//       payer: authorityAddress,
//       swigAddress: swigAccount,
//       bump: 0,
//       endSlot: 0n,
//       startSlot: 0n,
//       id: mockBytesArray(2, 13),
//     });

//     assert(uint8ArraysEqual(createInstructionData, Uint8Array.from(ix.data)));
//   });

//   test('AddAuthorityV1 instruction data!', () => {
//     let addInstructionData = Uint8Array.from(
//       readFileSync('tests/sanity/data/add_authority.bin'),
//     );

//     let authorityAddress = mockPublicKey(2);

//     let authority = Authority.ed25519(authorityAddress);
//     let swigAccount = mockPublicKey(3);

//     let newAuthority = Authority.ed25519(mockPublicKey(4));

//     let ix = authority.addAuthority({
//       payer: authorityAddress,
//       swigAddress: swigAccount,
//       actions: [
//         action('Token', {
//           key: mockBytesArray(5, 32),
//           action: tokenAction('Manage', [200n]),
//         }),
//       ],
//       endSlot: 0n,
//       startSlot: 0n,
//       actingRoleId: 1,
//       newAuthority,
//     });

//     assert(uint8ArraysEqual(addInstructionData, Uint8Array.from(ix.data)));
//   });

//   test('RemoveAuthorityV1 instruction data!', () => {
//     let removeInstructionData = Uint8Array.from(
//       readFileSync('tests/sanity/data/remove_authority.bin'),
//     );

//     let authorityAddress = mockPublicKey(2);

//     let authority = Authority.ed25519(authorityAddress);
//     let swigAccount = mockPublicKey(3);

//     let ix = authority.removeAuthority({
//       payer: authorityAddress,
//       swigAddress: swigAccount,
//       roleId: 1,
//       roleIdToRemove: 2,
//     });

//     assert(uint8ArraysEqual(removeInstructionData, Uint8Array.from(ix.data)));
//   });

//   test('ReplaceAuthorityV1 instruction data!', () => {
//     let replaceInstructionData = Uint8Array.from(
//       readFileSync('tests/sanity/data/replace_authority.bin'),
//     );

//     let authorityAddress = mockPublicKey(2);

//     let authority = Authority.ed25519(authorityAddress);
//     let swigAccount = mockPublicKey(3);

//     let newAuthority = Authority.ed25519(mockPublicKey(4));

//     let ix = authority.replaceAuthority({
//       payer: authorityAddress,
//       swigAddress: swigAccount,
//       actions: [
//         action('Token', {
//           key: mockBytesArray(5, 32),
//           action: tokenAction('Manage', [200n]),
//         }),
//       ],
//       newAuthority,
//       endSlot: 0n,
//       startSlot: 0n,
//       roleIdToReplace: 2,
//       roleId: 1,
//     });

//     assert(uint8ArraysEqual(replaceInstructionData, Uint8Array.from(ix.data)));
//   });

//   test('SignV1 instruction data!', () => {
//     let signInstructionData = Uint8Array.from(
//       readFileSync('tests/sanity/data/sign.bin'),
//     );

//     let authorityAddress = mockPublicKey(2);

//     let authority = Authority.ed25519(authorityAddress);
//     let swigAccount = mockPublicKey(3);

//     let account1 = mockPublicKey(4);
//     let account2 = mockPublicKey(5);

//     let programId = mockPublicKey(6);

//     let ix = authority.sign({
//       payer: authorityAddress,
//       swigAddress: swigAccount,
//       roleId: 1,
//       innerInstructions: [
//         new TransactionInstruction({
//           programId,
//           keys: [
//             {
//               pubkey: account1,
//               isSigner: true,
//               isWritable: true,
//             },
//             {
//               pubkey: account2,
//               isSigner: false,
//               isWritable: true,
//             },
//             {
//               pubkey: account1,
//               isSigner: false,
//               isWritable: false,
//             },
//             {
//               pubkey: swigAccount,
//               isSigner: true,
//               isWritable: false,
//             },
//           ],
//           data: Buffer.from(new Uint8Array([7, 9])),
//         }),
//       ],
//     });

//     assert(uint8ArraysEqual(signInstructionData, Uint8Array.from(ix.data)));
//   });
// });
