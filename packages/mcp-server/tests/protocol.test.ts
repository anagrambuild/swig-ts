import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Permission, SWIG_PROGRAM_ADDRESS } from '@swig-wallet/classic';
import { describe, expect, test } from 'bun:test';
import {
  createV2SubAccountInstruction,
  deriveV2SubAccountAddresses,
  replaceEd25519AuthorityInstruction,
  setRentClaimerInstruction,
  toggleV2SubAccountInstruction,
  withdrawSolFromV2SubAccountInstruction,
} from '../src/protocol';

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
});
