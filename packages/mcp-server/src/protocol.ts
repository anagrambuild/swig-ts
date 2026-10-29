import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { SWIG_PROGRAM_ADDRESS } from '@swig-wallet/classic';
import elliptic from 'elliptic';
import { createHash } from 'node:crypto';

const { ec: EC, eddsa: EDDSA } = elliptic;

const RESERVATION_DOMAIN = Buffer.from('rsv');

export type ReservationAuthorityType = 'ed25519' | 'secp256k1' | 'secp256r1';

export function parseHex(value: string, name: string): Buffer {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error(`${name} must be even-length hexadecimal`);
  }
  return Buffer.from(value, 'hex');
}

export function reservationFromPackage(bytes: Uint8Array): {
  package: Buffer;
  authorityType: ReservationAuthorityType;
  authority: Buffer;
  config: PublicKey;
  wallet: PublicKey;
} {
  const pkg = Buffer.from(bytes);
  if (
    (pkg.length !== 99 && pkg.length !== 100) ||
    pkg[0] !== 1 ||
    !pkg.subarray(1, 33).equals(SWIG_PROGRAM_ADDRESS.toBuffer())
  ) {
    throw new Error('Invalid Swig V1 reservation package');
  }
  const code = pkg.readUInt16LE(65);
  const authorityType: ReservationAuthorityType =
    code === 1
      ? 'ed25519'
      : code === 3
        ? 'secp256k1'
        : code === 5
          ? 'secp256r1'
          : (() => {
              throw new Error('Unsupported reservation authority type');
            })();
  const authority = pkg.subarray(67);
  if (authorityType === 'ed25519') {
    if (authority.length !== 32 || !PublicKey.isOnCurve(authority)) {
      throw new Error('Reservation requires an on-curve Ed25519 public key');
    }
    const curve = new EDDSA('ed25519');
    const point = curve.decodePoint(authority.toString('hex'));
    // Match the program's canonical encoding and cofactor checks. Merely
    // being on-curve also admits small-order points that cannot activate.
    if (
      !Buffer.from(curve.encodePoint(point)).equals(authority) ||
      point.dbl().dbl().dbl().isInfinity()
    ) {
      throw new Error(
        'Reservation requires a canonical non-small-order Ed25519 public key',
      );
    }
  } else {
    if (authority.length !== 33 || ![2, 3].includes(authority[0])) {
      throw new Error('Reservation requires a compressed SEC1 public key');
    }
    const curve = new EC(authorityType === 'secp256k1' ? 'secp256k1' : 'p256');
    const key = curve.keyFromPublic(authority);
    if (
      !key.validate().result ||
      !Buffer.from(key.getPublic(true, 'array')).equals(authority)
    ) {
      throw new Error('Reservation public key is not canonical');
    }
  }
  const commitment = createHash('sha256')
    .update(RESERVATION_DOMAIN)
    .update(pkg.subarray(0, 67))
    .update(authority)
    .digest();
  const config = PublicKey.findProgramAddressSync(
    [RESERVATION_DOMAIN, commitment],
    SWIG_PROGRAM_ADDRESS,
  )[0];
  const wallet = PublicKey.findProgramAddressSync(
    [Buffer.from('swig-wallet-address'), config.toBuffer()],
    SWIG_PROGRAM_ADDRESS,
  )[0];
  return { package: pkg, authorityType, authority, config, wallet };
}

export function createReservationPackage(args: {
  salt: Uint8Array;
  authorityType: ReservationAuthorityType;
  authority: Uint8Array;
}) {
  if (args.salt.length !== 32)
    throw new Error('Reservation salt must be 32 bytes');
  const code =
    args.authorityType === 'ed25519'
      ? 1
      : args.authorityType === 'secp256k1'
        ? 3
        : 5;
  const pkg = Buffer.alloc(67 + args.authority.length);
  pkg[0] = 1;
  SWIG_PROGRAM_ADDRESS.toBuffer().copy(pkg, 1);
  Buffer.from(args.salt).copy(pkg, 33);
  pkg.writeUInt16LE(code, 65);
  Buffer.from(args.authority).copy(pkg, 67);
  return reservationFromPackage(pkg);
}

export function createReservedWalletInstruction(args: {
  package: Uint8Array;
  payer: PublicKey;
}): TransactionInstruction {
  const reservation = reservationFromPackage(args.package);
  const data = Buffer.concat([Buffer.from([24, 0]), reservation.package]);
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: reservation.config, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: reservation.wallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Read the current Swig header, role boundaries, and typed tail entries. */
export function readSwigTail(data: Buffer): {
  rentClaimer: PublicKey | null;
  activeSubAccountCount: number | null;
} {
  if (data.length < 48 || data[0] !== 1)
    throw new Error('Invalid Swig config account');
  const roles = data.readUInt16LE(34);
  let cursor = 48;
  for (let i = 0; i < roles; i++) {
    if (cursor + 16 > data.length) throw new Error('Truncated Swig role');
    const boundary = 48 + data.readUInt32LE(cursor + 12);
    if (boundary <= cursor || boundary > data.length) {
      throw new Error('Invalid Swig role boundary');
    }
    cursor = boundary;
  }
  let rentClaimer: PublicKey | null = null;
  let activeSubAccountCount: number | null = null;
  while (cursor < data.length) {
    if (cursor + 8 > data.length) throw new Error('Truncated Swig tail');
    const kind = data[cursor];
    const version = data[cursor + 1];
    const valueLen = data.readUInt16LE(cursor + 2);
    const end = cursor + 8 + valueLen;
    if (
      version !== 1 ||
      end > data.length ||
      !data.subarray(cursor + 4, cursor + 8).equals(Buffer.alloc(4))
    ) {
      throw new Error('Invalid Swig tail entry');
    }
    const value = data.subarray(cursor + 8, end);
    if (kind === 1 && valueLen === 32 && rentClaimer === null) {
      rentClaimer = new PublicKey(value);
    } else if (kind === 2 && valueLen === 8 && activeSubAccountCount === null) {
      if (!value.subarray(4).equals(Buffer.alloc(4))) {
        throw new Error('Invalid Swig active count');
      }
      activeSubAccountCount = value.readUInt32LE(0);
    } else if (kind !== 4) {
      throw new Error('Unknown or duplicate Swig tail entry');
    }
    cursor = end;
  }
  return { rentClaimer, activeSubAccountCount };
}

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
  tokenAccounts?: {
    source: PublicKey;
    destination: PublicKey;
    program: PublicKey;
  };
}): TransactionInstruction {
  const addresses = deriveV2SubAccountAddresses(args.swig, args.subAccountId);
  const data = Buffer.alloc(25);
  data.writeUInt16LE(21, 0);
  data.writeUInt32LE(u32(args.roleId, 'roleId'), 4);
  data.writeUInt32LE(u32(args.subAccountId, 'subAccountId'), 8);
  data.writeBigUInt64LE(u64(args.amountLamports, 'amountLamports'), 16);
  data[24] = 5;
  const keys = [
    { pubkey: args.swig, isSigner: false, isWritable: true },
    { pubkey: args.payer, isSigner: true, isWritable: true },
    { pubkey: addresses.state, isSigner: false, isWritable: false },
    { pubkey: addresses.asset, isSigner: false, isWritable: true },
    { pubkey: args.swigWalletAddress, isSigner: false, isWritable: true },
    { pubkey: args.signer, isSigner: true, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  if (args.tokenAccounts) {
    keys.push(
      { pubkey: args.tokenAccounts.source, isSigner: false, isWritable: true },
      {
        pubkey: args.tokenAccounts.destination,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: args.tokenAccounts.program,
        isSigner: false,
        isWritable: false,
      },
    );
  }
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys,
    data,
  });
}

/** Swig protocol SubAccountSignV2 (20), compact inner instructions, Ed25519. */
export function signV2SubAccountInstruction(args: {
  swig: PublicKey;
  signer: PublicKey;
  roleId: number;
  subAccountId: number;
  innerInstructions: TransactionInstruction[];
}): TransactionInstruction {
  if (
    args.innerInstructions.length === 0 ||
    args.innerInstructions.length > 255
  ) {
    throw new Error('Provide between 1 and 255 inner instructions');
  }
  const addresses = deriveV2SubAccountAddresses(args.swig, args.subAccountId);
  const keys = [
    { pubkey: args.swig, isSigner: false, isWritable: true },
    { pubkey: addresses.state, isSigner: false, isWritable: false },
    { pubkey: addresses.asset, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: args.signer, isSigner: true, isWritable: false },
  ];
  const parts: Buffer[] = [Buffer.from([args.innerInstructions.length])];
  for (const inner of args.innerInstructions) {
    if (
      keys.length >= 254 ||
      inner.keys.length > 254 ||
      inner.data.length > 65535
    ) {
      throw new Error('V2 inner instruction exceeds compact encoding limits');
    }
    const programIndex = keys.length;
    keys.push({ pubkey: inner.programId, isSigner: false, isWritable: false });
    const indices: number[] = [];
    for (const meta of inner.keys) {
      if (meta.isSigner && !meta.pubkey.equals(addresses.asset)) {
        throw new Error('Only the V2 asset PDA may sign inner instructions');
      }
      let index = keys.findIndex((key) => key.pubkey.equals(meta.pubkey));
      if (index < 0) {
        index = keys.length;
        keys.push({
          pubkey: meta.pubkey,
          isSigner: false,
          isWritable: meta.isWritable,
        });
      } else if (meta.isWritable) {
        keys[index].isWritable = true;
      }
      indices.push(index);
    }
    if (keys.length > 254) {
      throw new Error('V2 inner instruction exceeds compact account limit');
    }
    const compactIx = Buffer.alloc(
      1 + 1 + indices.length + 2 + inner.data.length,
    );
    compactIx[0] = programIndex;
    compactIx[1] = indices.length;
    compactIx.set(indices, 2);
    compactIx.writeUInt16LE(inner.data.length, 2 + indices.length);
    compactIx.set(inner.data, 4 + indices.length);
    parts.push(compactIx);
  }
  const compact = Buffer.concat(parts);
  if (compact.length > 65535) {
    throw new Error('V2 instruction payload exceeds u16 length');
  }
  const data = Buffer.alloc(16 + compact.length + 1);
  data.writeUInt16LE(20, 0);
  data.writeUInt16LE(compact.length, 2);
  data.writeUInt32LE(u32(args.roleId, 'roleId'), 4);
  data.writeUInt32LE(u32(args.subAccountId, 'subAccountId'), 8);
  compact.copy(data, 16);
  data[data.length - 1] = 4;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys,
    data,
  });
}

/** Swig protocol CloseSubAccountV1 (22), for an Ed25519 signer. */
export function closeV1SubAccountInstruction(args: {
  swig: PublicKey;
  payer: PublicKey;
  signer: PublicKey;
  actingRoleId: number;
  childRoleId: number;
  child: PublicKey;
  wallet: PublicKey;
  rentClaimer: PublicKey | null;
}): TransactionInstruction {
  const data = Buffer.alloc(17);
  data.writeUInt16LE(22, 0);
  data.writeUInt32LE(u32(args.actingRoleId, 'actingRoleId'), 4);
  data.writeUInt32LE(u32(args.childRoleId, 'childRoleId'), 8);
  data[16] = 6;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: args.child, isSigner: false, isWritable: true },
      { pubkey: args.wallet, isSigner: false, isWritable: true },
      {
        pubkey: args.rentClaimer ?? SWIG_PROGRAM_ADDRESS,
        isSigner: false,
        isWritable: args.rentClaimer !== null,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Swig protocol CloseSubAccountV2 (23), for an Ed25519 signer. */
export function closeV2SubAccountInstruction(args: {
  swig: PublicKey;
  payer: PublicKey;
  signer: PublicKey;
  actingRoleId: number;
  subAccountId: number;
  wallet: PublicKey;
  rentClaimer: PublicKey | null;
}): TransactionInstruction {
  const addresses = deriveV2SubAccountAddresses(args.swig, args.subAccountId);
  const data = Buffer.alloc(17);
  data.writeUInt16LE(23, 0);
  data.writeUInt32LE(u32(args.actingRoleId, 'actingRoleId'), 4);
  data.writeUInt32LE(u32(args.subAccountId, 'subAccountId'), 8);
  data[16] = 7;
  return new TransactionInstruction({
    programId: SWIG_PROGRAM_ADDRESS,
    keys: [
      { pubkey: args.swig, isSigner: false, isWritable: true },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: addresses.state, isSigner: false, isWritable: true },
      { pubkey: addresses.asset, isSigner: false, isWritable: true },
      { pubkey: args.wallet, isSigner: false, isWritable: true },
      {
        pubkey: args.rentClaimer ?? SWIG_PROGRAM_ADDRESS,
        isSigner: false,
        isWritable: args.rentClaimer !== null,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data,
  });
}
