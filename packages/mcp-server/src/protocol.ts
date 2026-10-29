import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { SWIG_PROGRAM_ADDRESS } from '@swig-wallet/classic';

function u32(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${name} must be a u32`);
  }
  return value;
}

function u64(value: bigint, name: string): bigint {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new Error(`${name} must be a u64`);
  }
  return value;
}

export function deriveV2SubAccountAddresses(
  swig: PublicKey,
  subAccountId: number,
): {
  state: PublicKey;
  asset: PublicKey;
} {
  const id = Buffer.alloc(4);
  id.writeUInt32LE(u32(subAccountId, 'subAccountId'));
  return {
    state: PublicKey.findProgramAddressSync(
      [Buffer.from('sub-account-v2-state-address'), swig.toBuffer(), id],
      SWIG_PROGRAM_ADDRESS,
    )[0],
    asset: PublicKey.findProgramAddressSync(
      [Buffer.from('sub-account-v2-address'), swig.toBuffer(), id],
      SWIG_PROGRAM_ADDRESS,
    )[0],
  };
}

/** Swig protocol SetRentClaimerV1 (17), for an Ed25519 signer. */
export function setRentClaimerInstruction(args: {
  swig: PublicKey;
  payer: PublicKey;
  signer: PublicKey;
  roleId: number;
  rentClaimer: PublicKey;
}): TransactionInstruction {
  const data = Buffer.alloc(41);
  data.writeUInt16LE(17, 0);
  data.writeUInt32LE(u32(args.roleId, 'roleId'), 4);
  data.set(args.rentClaimer.toBytes(), 8);
  data[40] = 3;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Swig protocol ReplaceAuthorityV1 (16), for an Ed25519 signer and target. */
export function replaceEd25519AuthorityInstruction(args: {
  swig: PublicKey;
  signer: PublicKey;
  actingRoleId: number;
  targetRoleId: number;
  newSigner: PublicKey;
}): TransactionInstruction {
  const data = Buffer.alloc(49);
  data.writeUInt16LE(16, 0);
  data.writeUInt32LE(u32(args.actingRoleId, 'actingRoleId'), 4);
  data.writeUInt32LE(u32(args.targetRoleId, 'targetRoleId'), 8);
  data.writeUInt16LE(32, 12);
  data.set(args.newSigner.toBytes(), 16);
  data[48] = 1;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Swig protocol CreateSubAccountV2 (18), for an Ed25519 signer. */
export function createV2SubAccountInstruction(args: {
  swig: PublicKey;
  payer: PublicKey;
  signer: PublicKey;
  roleId: number;
  subAccountId: number;
}): TransactionInstruction {
  const addresses = deriveV2SubAccountAddresses(args.swig, args.subAccountId);
  const data = Buffer.alloc(17);
  data.writeUInt16LE(18, 0);
  data.writeUInt32LE(u32(args.roleId, 'roleId'), 4);
  data[16] = 5;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: addresses.state, isSigner: false, isWritable: true },
      { pubkey: addresses.asset, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Swig protocol ToggleSubAccountV2 (19), for an Ed25519 signer. */
export function toggleV2SubAccountInstruction(args: {
  swig: PublicKey;
  payer: PublicKey;
  signer: PublicKey;
  roleId: number;
  subAccountId: number;
  enabled: boolean;
}): TransactionInstruction {
  const addresses = deriveV2SubAccountAddresses(args.swig, args.subAccountId);
  const data = Buffer.alloc(17);
  data.writeUInt16LE(19, 0);
  data[2] = args.enabled ? 1 : 0;
  data.writeUInt32LE(u32(args.roleId, 'roleId'), 4);
  data.writeUInt32LE(u32(args.subAccountId, 'subAccountId'), 8);
  data[16] = 3;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: addresses.state, isSigner: false, isWritable: true },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Swig protocol WithdrawFromSubAccountV2 (21), SOL variant. */
export function withdrawSolFromV2SubAccountInstruction(args: {
  swig: PublicKey;
  payer: PublicKey;
  signer: PublicKey;
  swigWalletAddress: PublicKey;
  roleId: number;
  subAccountId: number;
  amountLamports: bigint;
}): TransactionInstruction {
  const addresses = deriveV2SubAccountAddresses(args.swig, args.subAccountId);
  const data = Buffer.alloc(25);
  data.writeUInt16LE(21, 0);
  data.writeUInt32LE(u32(args.roleId, 'roleId'), 4);
  data.writeUInt32LE(u32(args.subAccountId, 'subAccountId'), 8);
  data.writeBigUInt64LE(u64(args.amountLamports, 'amountLamports'), 16);
  data[24] = 5;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: addresses.state, isSigner: false, isWritable: false },
      { pubkey: addresses.asset, isSigner: false, isWritable: true },
      { pubkey: args.swigWalletAddress, isSigner: false, isWritable: true },
      { pubkey: args.signer, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
