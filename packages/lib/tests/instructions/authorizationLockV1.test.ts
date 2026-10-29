/**
 * Tests for AddAuthorizationLockV1 / RemoveAuthorizationLockV1 encoding
 *
 * Expected bytes and account metas were produced by the Rust builders in
 * swig-wallet `interface/src/lib.rs` (`AddAuthorizationLockV1Instruction`,
 * `RemoveAuthorizationLockV1Instruction`) for the same inputs.
 */

import {
  getAddAuthorizationLockV1InstructionDataCodec,
  getRemoveAuthorizationLockV1InstructionDataCodec,
  identifySwigInstruction,
  SwigInstructionDiscriminator,
} from '@swig-wallet/coder';
import {
  Ed25519Instruction,
  Secp256k1Instruction,
  SolPublicKey,
  type SolInstruction,
} from '../../src';

const pk = (byte: number) => new SolPublicKey(new Uint8Array(32).fill(byte));

const swig = pk(1);
const payer = pk(2);
const authority = pk(3);
const wallet = pk(4);
const tokenAccount = pk(5);
const mint = pk(6);
const rentClaimer = pk(7);

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

function metas(ix: SolInstruction) {
  return ix.accounts.map((a) => [a.publicKey.toBase58(), a.writable, a.signer]);
}

const constantSigningFn = async () => ({
  signature: new Uint8Array(65).fill(0x11),
});

describe('AuthorizationLockV1 instructions', () => {
  test('discriminators are 25 and 26', () => {
    expect(SwigInstructionDiscriminator.AddAuthorizationLockV1).toBe(25);
    expect(SwigInstructionDiscriminator.RemoveAuthorizationLockV1).toBe(26);
    expect(SwigInstructionDiscriminator.CloseSwigV1).toBe(15);
    expect(identifySwigInstruction(Uint8Array.from([25, 0]))).toBe(
      SwigInstructionDiscriminator.AddAuthorizationLockV1,
    );
    expect(identifySwigInstruction(Uint8Array.from([26, 0]))).toBe(
      SwigInstructionDiscriminator.RemoveAuthorizationLockV1,
    );
  });

  describe('AddAuthorizationLockV1', () => {
    test('Ed25519 native SOL lock matches Rust builder', async () => {
      const ctx = await Ed25519Instruction.addAuthorizationLockV1Instruction(
        {
          swig,
          payer,
          swigSystemAddress: wallet,
          assetAccount: wallet,
        },
        {
          authorityData: authority.toBytes(),
          actingRoleId: 2,
          amount: 1_000_000_000n,
          expirySlot: 123_456n,
        },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1900000002000000' +
          '04'.repeat(32) +
          '00'.repeat(32) +
          '00ca9a3b00000000' +
          '40e2010000000000' +
          '05',
      );
      expect(ix.data.length).toBe(88 + 1);
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [wallet.toBase58(), false, false],
        [wallet.toBase58(), false, false],
        [authority.toBase58(), false, true],
      ]);
    });

    test('Ed25519 token lock appends the mint account', async () => {
      const ctx = await Ed25519Instruction.addAuthorizationLockV1Instruction(
        {
          swig,
          payer,
          swigSystemAddress: wallet,
          assetAccount: tokenAccount,
          mint,
        },
        {
          authorityData: authority.toBytes(),
          actingRoleId: 0x01020304,
          amount: 0x0102030405060708n,
          expirySlot: 0x1112131415161718n,
        },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1900000004030201' +
          '05'.repeat(32) +
          '06'.repeat(32) +
          '0807060504030201' +
          '1817161514131211' +
          '06',
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [wallet.toBase58(), false, false],
        [tokenAccount.toBase58(), false, false],
        [mint.toBase58(), false, false],
        [authority.toBase58(), false, true],
      ]);
    });

    test('an all-zero mint is treated as native SOL', async () => {
      const ctx = await Ed25519Instruction.addAuthorizationLockV1Instruction(
        {
          swig,
          payer,
          swigSystemAddress: wallet,
          assetAccount: wallet,
          mint: pk(0),
        },
        {
          authorityData: authority.toBytes(),
          actingRoleId: 2,
          amount: 1n,
          expirySlot: 2n,
        },
      );
      expect(ctx.swigInstruction.accounts.length).toBe(6);
    });

    test('Secp256k1 token lock matches Rust builder', async () => {
      const ctx = await Secp256k1Instruction.addAuthorizationLockV1Instruction(
        {
          swig,
          payer,
          swigSystemAddress: wallet,
          assetAccount: tokenAccount,
          mint,
        },
        {
          authorityData: new Uint8Array(64),
          actingRoleId: 1,
          amount: 42n,
          expirySlot: 900n,
        },
        { signingFn: constantSigningFn, currentSlot: 500n, odometer: 1 },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1900000001000000' +
          '05'.repeat(32) +
          '06'.repeat(32) +
          '2a00000000000000' +
          '8403000000000000' +
          'f401000000000000' +
          '01000000' +
          '11'.repeat(65),
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [wallet.toBase58(), false, false],
        [tokenAccount.toBase58(), false, false],
        [mint.toBase58(), false, false],
      ]);
    });

    test('codec round trips', () => {
      const { codec } = getAddAuthorizationLockV1InstructionDataCodec();
      const bytes = codec.encode({
        actingRoleId: 7,
        assetAccount: tokenAccount.toBytes(),
        mint: mint.toBytes(),
        amount: 99n,
        expirySlot: 1000n,
        authorityPayload: Uint8Array.from([9]),
      });
      expect(bytes.length).toBe(89);
      const decoded = codec.decode(bytes);
      expect(decoded.discriminator).toBe(25);
      expect(decoded.actingRoleId).toBe(7);
      expect(Array.from(decoded.assetAccount)).toEqual(
        Array.from(tokenAccount.toBytes()),
      );
      expect(Array.from(decoded.mint)).toEqual(Array.from(mint.toBytes()));
      expect(decoded.amount).toBe(99n);
      expect(decoded.expirySlot).toBe(1000n);
      expect(Array.from(decoded.authorityPayload)).toEqual([9]);
    });
  });

  describe('RemoveAuthorizationLockV1', () => {
    test('Ed25519 without rent claimer matches Rust builder', async () => {
      const ctx = await Ed25519Instruction.removeAuthorizationLockV1Instruction(
        { swig, payer },
        { authorityData: authority.toBytes(), actingRoleId: 2, lockId: 9 },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe('1a00000002000000090000000000000003');
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [authority.toBase58(), false, true],
      ]);
    });

    test('Ed25519 with rent claimer matches Rust builder', async () => {
      const ctx = await Ed25519Instruction.removeAuthorizationLockV1Instruction(
        { swig, payer, rentClaimer },
        {
          authorityData: authority.toBytes(),
          actingRoleId: 2,
          lockId: 0xdeadbeef,
        },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe('1a00000002000000efbeadde0000000004');
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [rentClaimer.toBase58(), true, false],
        [authority.toBase58(), false, true],
      ]);
    });

    test('Secp256k1 with rent claimer matches Rust builder', async () => {
      const ctx =
        await Secp256k1Instruction.removeAuthorizationLockV1Instruction(
          { swig, payer, rentClaimer },
          { authorityData: new Uint8Array(64), actingRoleId: 1, lockId: 3 },
          { signingFn: constantSigningFn, currentSlot: 500n, odometer: 1 },
        );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1a000000010000000300000000000000' +
          'f401000000000000' +
          '01000000' +
          '11'.repeat(65),
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [rentClaimer.toBase58(), true, false],
      ]);
    });

    test('codec round trips', () => {
      const { codec } = getRemoveAuthorizationLockV1InstructionDataCodec();
      const bytes = codec.encode({
        actingRoleId: 4,
        lockId: 12,
        authorityPayload: Uint8Array.from([3]),
      });
      expect(bytes.length).toBe(17);
      const decoded = codec.decode(bytes);
      expect(decoded.discriminator).toBe(26);
      expect(decoded.actingRoleId).toBe(4);
      expect(decoded.lockId).toBe(12);
      expect(Array.from(decoded._reserved)).toEqual([0, 0, 0, 0]);
      expect(Array.from(decoded.authorityPayload)).toEqual([3]);
    });
  });
});
