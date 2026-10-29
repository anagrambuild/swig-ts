import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Permission, SWIG_PROGRAM_ADDRESS } from '@swig-wallet/classic';
import { describe, expect, test } from 'bun:test';
import elliptic from 'elliptic';
import {
  closeV1SubAccountInstruction,
  closeV2SubAccountInstruction,
  createReservationPackage,
  createReservedWalletInstruction,
  createV2SubAccountInstruction,
  deriveV2SubAccountAddresses,
  readSwigTail,
  replaceEd25519AuthorityInstruction,
  reservationFromPackage,
  setRentClaimerInstruction,
  signV2SubAccountInstruction,
  toggleV2SubAccountInstruction,
  withdrawSolFromV2SubAccountInstruction,
} from '../src/protocol';

const { ec: EC } = elliptic;

describe('current Swig protocol instruction layout', () => {
  test('SetRentClaimerV1 matches the Rust Ed25519 builder', () => {
    const swig = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const rentClaimer = Keypair.generate().publicKey;
    const ix = setRentClaimerInstruction({
      swig,
      payer,
      signer: payer,
      roleId: 7,
      rentClaimer,
    });
    expect(ix.programId.equals(SWIG_PROGRAM_ADDRESS)).toBe(true);
    expect(ix.keys).toEqual([
      { pubkey: swig, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: false },
    ]);
    expect(ix.data.length).toBe(41);
    expect(ix.data.readUInt16LE(0)).toBe(17);
    expect(Array.from(ix.data.subarray(2, 4))).toEqual([0, 0]);
    expect(ix.data.readUInt32LE(4)).toBe(7);
    expect(ix.data.subarray(8, 40).equals(rentClaimer.toBuffer())).toBe(true);
    expect(ix.data[40]).toBe(3);
  });

  test('ReplaceAuthorityV1 matches the Rust Ed25519 builder', () => {
    const swig = Keypair.generate().publicKey;
    const signer = Keypair.generate().publicKey;
    const newSigner = Keypair.generate().publicKey;
    const ix = replaceEd25519AuthorityInstruction({
      swig,
      signer,
      actingRoleId: 3,
      targetRoleId: 7,
      newSigner,
    });
    expect(ix.programId.equals(SWIG_PROGRAM_ADDRESS)).toBe(true);
    expect(ix.keys).toEqual([
      { pubkey: swig, isSigner: false, isWritable: true },
      { pubkey: signer, isSigner: true, isWritable: false },
    ]);
    expect(ix.data.length).toBe(49);
    expect(ix.data.readUInt16LE(0)).toBe(16);
    expect(Array.from(ix.data.subarray(2, 4))).toEqual([0, 0]);
    expect(ix.data.readUInt32LE(4)).toBe(3);
    expect(ix.data.readUInt32LE(8)).toBe(7);
    expect(ix.data.readUInt16LE(12)).toBe(32);
    expect(Array.from(ix.data.subarray(14, 16))).toEqual([0, 0]);
    expect(ix.data.subarray(16, 48).equals(newSigner.toBuffer())).toBe(true);
    expect(ix.data[48]).toBe(1);
    expect(Permission.ReplaceAuthority).toBe(21);
    expect(() =>
      replaceEd25519AuthorityInstruction({
        swig,
        signer,
        actingRoleId: 3,
        targetRoleId: -1,
        newSigner,
      }),
    ).toThrow('u32');
  });

  test('V2 sub-account PDA seeds and create layout match the Rust builder', () => {
    const swig = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const id = Buffer.alloc(4);
    id.writeUInt32LE(7);
    const addresses = deriveV2SubAccountAddresses(swig, 7);
    expect(addresses.state).toEqual(
      PublicKey.findProgramAddressSync(
        [Buffer.from('sub-account-v2-state-address'), swig.toBuffer(), id],
        SWIG_PROGRAM_ADDRESS,
      )[0],
    );
    expect(addresses.asset).toEqual(
      PublicKey.findProgramAddressSync(
        [Buffer.from('sub-account-v2-address'), swig.toBuffer(), id],
        SWIG_PROGRAM_ADDRESS,
      )[0],
    );
    const ix = createV2SubAccountInstruction({
      swig,
      payer,
      signer: payer,
      roleId: 3,
      subAccountId: 7,
    });
    expect(ix.keys.map((key) => key.pubkey)).toEqual([
      swig,
      payer,
      addresses.state,
      addresses.asset,
      SystemProgram.programId,
      payer,
    ]);
    expect(ix.keys.map((key) => [key.isSigner, key.isWritable])).toEqual([
      [false, true],
      [true, true],
      [false, true],
      [false, true],
      [false, false],
      [true, false],
    ]);
    expect(ix.data.length).toBe(17);
    expect(ix.data.readUInt16LE(0)).toBe(18);
    expect(ix.data.readUInt32LE(4)).toBe(3);
    expect(Array.from(ix.data.subarray(8, 16))).toEqual(Array(8).fill(0));
    expect(ix.data[16]).toBe(5);
  });

  test('V2 toggle and SOL withdraw layouts match the Rust builders', () => {
    const swig = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const addresses = deriveV2SubAccountAddresses(swig, 7);
    const toggle = toggleV2SubAccountInstruction({
      swig,
      payer,
      signer: payer,
      roleId: 3,
      subAccountId: 7,
      enabled: false,
    });
    expect(toggle.keys.map((key) => key.pubkey)).toEqual([
      swig,
      payer,
      addresses.state,
      payer,
    ]);
    expect(toggle.keys.map((key) => [key.isSigner, key.isWritable])).toEqual([
      [false, true],
      [true, true],
      [false, true],
      [true, false],
    ]);
    expect(toggle.data.length).toBe(17);
    expect(toggle.data.readUInt16LE(0)).toBe(19);
    expect(toggle.data[2]).toBe(0);
    expect(toggle.data.readUInt32LE(4)).toBe(3);
    expect(toggle.data.readUInt32LE(8)).toBe(7);
    expect(toggle.data[16]).toBe(3);
    const withdraw = withdrawSolFromV2SubAccountInstruction({
      swig,
      payer,
      signer: payer,
      swigWalletAddress: wallet,
      roleId: 3,
      subAccountId: 7,
      amountLamports: 1_000_000n,
    });
    expect(withdraw.keys.map((key) => key.pubkey)).toEqual([
      swig,
      payer,
      addresses.state,
      addresses.asset,
      wallet,
      payer,
      SystemProgram.programId,
    ]);
    expect(withdraw.keys.map((key) => [key.isSigner, key.isWritable])).toEqual([
      [false, true],
      [true, true],
      [false, false],
      [false, true],
      [false, true],
      [true, false],
      [false, false],
    ]);
    expect(withdraw.data.length).toBe(25);
    expect(withdraw.data.readUInt16LE(0)).toBe(21);
    expect(withdraw.data.readUInt32LE(4)).toBe(3);
    expect(withdraw.data.readUInt32LE(8)).toBe(7);
    expect(withdraw.data.readBigUInt64LE(16)).toBe(1_000_000n);
    expect(withdraw.data[24]).toBe(5);
    expect(() =>
      withdrawSolFromV2SubAccountInstruction({
        swig,
        payer,
        signer: payer,
        swigWalletAddress: wallet,
        roleId: 3,
        subAccountId: 7,
        amountLamports: -1n,
      }),
    ).toThrow('u64');
  });

  test('V2 token withdrawal appends exactly the three token accounts', () => {
    const swig = Keypair.generate().publicKey;
    const signer = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const source = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const program = Keypair.generate().publicKey;
    const ix = withdrawSolFromV2SubAccountInstruction({
      swig,
      payer: signer,
      signer,
      swigWalletAddress: wallet,
      roleId: 2,
      subAccountId: 9,
      amountLamports: 11n,
      tokenAccounts: { source, destination, program },
    });
    expect(ix.keys.slice(7)).toEqual([
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: program, isSigner: false, isWritable: false },
    ]);
    expect(ix.data.readUInt16LE(0)).toBe(21);
    expect(ix.data.readBigUInt64LE(16)).toBe(11n);
    expect(ix.data[24]).toBe(5);
  });

  test('V2 signing encodes compact inner instructions and asset PDA signer', () => {
    const swig = Keypair.generate().publicKey;
    const signer = Keypair.generate().publicKey;
    const addresses = deriveV2SubAccountAddresses(swig, 9);
    const recipient = Keypair.generate().publicKey;
    const inner = SystemProgram.transfer({
      fromPubkey: addresses.asset,
      toPubkey: recipient,
      lamports: 123n,
    });
    const ix = signV2SubAccountInstruction({
      swig,
      signer,
      roleId: 2,
      subAccountId: 9,
      innerInstructions: [inner],
    });
    expect(ix.keys.map((key) => key.pubkey)).toEqual([
      swig,
      addresses.state,
      addresses.asset,
      SystemProgram.programId,
      signer,
      SystemProgram.programId,
      recipient,
    ]);
    expect(ix.keys[2].isSigner).toBe(false);
    expect(ix.data.readUInt16LE(0)).toBe(20);
    expect(ix.data.readUInt32LE(4)).toBe(2);
    expect(ix.data.readUInt32LE(8)).toBe(9);
    expect(ix.data.readUInt16LE(2)).toBe(ix.data.length - 17);
    expect(Array.from(ix.data.subarray(16, 21))).toEqual([1, 5, 2, 2, 6]);
    expect(ix.data.readUInt16LE(21)).toBe(inner.data.length);
    expect(ix.data.subarray(23, -1).equals(inner.data)).toBe(true);
    expect(ix.data.at(-1)).toBe(4);
    expect(() =>
      signV2SubAccountInstruction({
        swig,
        signer,
        roleId: 2,
        subAccountId: 9,
        innerInstructions: [
          SystemProgram.transfer({
            fromPubkey: signer,
            toPubkey: recipient,
            lamports: 123n,
          }),
        ],
      }),
    ).toThrow('Only the V2 asset PDA');
  });

  test('V1 and V2 close layouts keep the rent destination optional', () => {
    const swig = Keypair.generate().publicKey;
    const signer = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const rentClaimer = Keypair.generate().publicKey;
    const child = Keypair.generate().publicKey;
    const v1 = closeV1SubAccountInstruction({
      swig,
      payer: signer,
      signer,
      actingRoleId: 0,
      childRoleId: 7,
      child,
      wallet,
      rentClaimer: null,
    });
    expect(v1.data.readUInt16LE(0)).toBe(22);
    expect(v1.data.readUInt32LE(8)).toBe(7);
    expect(v1.data[16]).toBe(6);
    expect(v1.keys.map((key) => key.pubkey)).toEqual([
      swig,
      signer,
      child,
      wallet,
      SWIG_PROGRAM_ADDRESS,
      SystemProgram.programId,
      signer,
    ]);
    expect(v1.keys[4].isWritable).toBe(false);
    const v2 = closeV2SubAccountInstruction({
      swig,
      payer: signer,
      signer,
      actingRoleId: 0,
      subAccountId: 9,
      wallet,
      rentClaimer,
    });
    const addresses = deriveV2SubAccountAddresses(swig, 9);
    expect(v2.data.readUInt16LE(0)).toBe(23);
    expect(v2.data.readUInt32LE(8)).toBe(9);
    expect(v2.data[16]).toBe(7);
    expect(v2.keys.map((key) => key.pubkey)).toEqual([
      swig,
      signer,
      addresses.state,
      addresses.asset,
      wallet,
      rentClaimer,
      SystemProgram.programId,
      signer,
    ]);
    expect(v2.keys[5].isWritable).toBe(true);
  });

  test('reserved package derives canonical addresses and activation layout', () => {
    const payer = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const salt = Buffer.alloc(32, 9);
    const reservation = createReservationPackage({
      salt,
      authorityType: 'ed25519',
      authority: owner.toBuffer(),
    });
    expect(reservation.package.length).toBe(99);
    expect(reservation.package[0]).toBe(1);
    expect(
      reservation.package
        .subarray(1, 33)
        .equals(SWIG_PROGRAM_ADDRESS.toBuffer()),
    ).toBe(true);
    expect(reservation.package.subarray(33, 65).equals(salt)).toBe(true);
    expect(reservation.package.readUInt16LE(65)).toBe(1);
    expect(reservationFromPackage(reservation.package).config).toEqual(
      reservation.config,
    );
    const ix = createReservedWalletInstruction({
      package: reservation.package,
      payer,
    });
    expect(ix.data.readUInt16LE(0)).toBe(24);
    expect(ix.data.subarray(2).equals(reservation.package)).toBe(true);
    expect(ix.keys.map((key) => key.pubkey)).toEqual([
      reservation.config,
      payer,
      reservation.wallet,
      SystemProgram.programId,
    ]);
    const bad = Buffer.from(reservation.package);
    bad[1] ^= 1;
    expect(() => reservationFromPackage(bad)).toThrow('Invalid Swig');
    for (const [authorityType, curve, code] of [
      ['secp256k1', 'secp256k1', 3],
      ['secp256r1', 'p256', 5],
    ] as const) {
      const secp = new EC(curve).genKeyPair();
      const secpReservation = createReservationPackage({
        salt,
        authorityType,
        authority: Buffer.from(secp.getPublic(true, 'array')),
      });
      expect(secpReservation.package.length).toBe(100);
      expect(secpReservation.package.readUInt16LE(65)).toBe(code);
    }
  });

  test('typed tail reads immutable rent claimer and live child count', () => {
    const claimer = Keypair.generate().publicKey;
    const data = Buffer.alloc(48 + 40 + 16);
    data[0] = 1;
    data[48] = 1;
    data[49] = 1;
    data.writeUInt16LE(32, 50);
    claimer.toBuffer().copy(data, 56);
    data[88] = 2;
    data[89] = 1;
    data.writeUInt16LE(8, 90);
    data.writeUInt32LE(3, 96);
    expect(readSwigTail(data)).toEqual({
      rentClaimer: claimer,
      activeSubAccountCount: 3,
    });
  });

  test('reserved Ed25519 keys reject small-order and noncanonical encodings', () => {
    const identity = Buffer.alloc(32);
    identity[0] = 1;
    const noncanonical = Buffer.alloc(32, 255);
    noncanonical[0] = 238; // y = p + 1 encodes the identity noncanonically.
    noncanonical[31] = 127;
    for (const authority of [Buffer.alloc(32), identity, noncanonical]) {
      expect(() =>
        createReservationPackage({
          salt: Buffer.alloc(32),
          authorityType: 'ed25519',
          authority,
        }),
      ).toThrow();
      const pkg = Buffer.alloc(99);
      pkg[0] = 1;
      SWIG_PROGRAM_ADDRESS.toBuffer().copy(pkg, 1);
      pkg.writeUInt16LE(1, 65);
      authority.copy(pkg, 67);
      expect(() =>
        createReservedWalletInstruction({
          package: pkg,
          payer: Keypair.generate().publicKey,
        }),
      ).toThrow();
    }
  });
});
