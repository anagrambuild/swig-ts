/**
 * Tests for AddAuthorizationLockV1 / RemoveAuthorizationLockV1 encoding
 *
 * Expected bytes and account metas were produced by the Rust builders in
 * swig-wallet `interface/src/lib.rs` (`AddAuthorizationLockV1Instruction`,
 * `RemoveAuthorizationLockV1Instruction`) for the same inputs.
 */

import { keccak_256 } from '@noble/hashes/sha3';
import {
  getAddAuthorizationLockV1InstructionDataCodec,
  getRemoveAuthorizationLockV1InstructionDataCodec,
  identifySwigInstruction,
  SwigInstructionDiscriminator,
} from '@swig-wallet/coder';
import {
  createProgramExecAuthorityInfo,
  Ed25519Instruction,
  ProgramExecInstruction,
  Secp256k1Instruction,
  Secp256r1Instruction,
  SolAccountMeta,
  SolInstruction,
  SolPublicKey,
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
const INSTRUCTIONS_SYSVAR = 'Sysvar1nstructions1111111111111111111111111';

const precedingProgram = pk(9);
const precedingPrefix = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
const programExecAuthorityData = createProgramExecAuthorityInfo(
  precedingProgram.toBytes(),
  precedingPrefix,
).data;

// ProgramExec binds to the preceding instruction's first two accounts,
// which must be the swig and the swig wallet address.
const programExecOptions = () => ({
  preInstructions: [
    new SolInstruction({
      program: precedingProgram,
      accounts: [
        SolAccountMeta.readonly(swig),
        SolAccountMeta.readonly(wallet),
      ],
      data: precedingPrefix,
    }),
  ],
});

const r1PublicKey = new Uint8Array(33).fill(2);
const r1SigningFn = async () => ({ signature: new Uint8Array(64).fill(0x22) });

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

  test('Secp256k1 signed messages match Rust builders', async () => {
    // The Rust builders sign keccak256 of the hex digest the TS signing
    // function receives.
    const signed: Uint8Array[] = [];
    const signingFn = async (message: Uint8Array) => {
      signed.push(message);
      return { signature: new Uint8Array(65) };
    };
    await Secp256k1Instruction.addAuthorizationLockV1Instruction(
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
      { signingFn, currentSlot: 500n, odometer: 1 },
    );
    await Secp256k1Instruction.removeAuthorizationLockV1Instruction(
      { swig, swigSystemAddress: wallet, payer, rentClaimer },
      { authorityData: new Uint8Array(64), actingRoleId: 1, lockId: 3 },
      { signingFn, currentSlot: 500n, odometer: 1 },
    );
    expect(signed.map((m) => hex(keccak_256(m)))).toEqual([
      '440b433ece5adbef14774dc0d6f452e5e5ffc65cd575463f2cba1afd75e5d85c',
      '031af61158e5394a1fc860ff939d918f11726f067341d4e4b460ba79d43bcc7e',
    ]);
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
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
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
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
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
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [tokenAccount.toBase58(), false, false],
        [mint.toBase58(), false, false],
      ]);
    });

    test('Secp256r1 token lock matches Rust builder', async () => {
      const ctx = await Secp256r1Instruction.addAuthorizationLockV1Instruction(
        {
          swig,
          payer,
          swigSystemAddress: wallet,
          assetAccount: tokenAccount,
          mint,
        },
        {
          authorityData: r1PublicKey,
          actingRoleId: 1,
          amount: 42n,
          expirySlot: 900n,
        },
        { signingFn: r1SigningFn, currentSlot: 500n, odometer: 1 },
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
          '06' +
          '00000000',
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [tokenAccount.toBase58(), false, false],
        [mint.toBase58(), false, false],
        [INSTRUCTIONS_SYSVAR, false, false],
      ]);
    });

    test('ProgramExec native SOL lock matches Rust builder', async () => {
      const ctx =
        await ProgramExecInstruction.addAuthorizationLockV1Instruction(
          { swig, payer, swigSystemAddress: wallet, assetAccount: wallet },
          {
            authorityData: programExecAuthorityData,
            actingRoleId: 2,
            amount: 7n,
            expirySlot: 100n,
          },
          programExecOptions(),
        );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1900000002000000' +
          '04'.repeat(32) +
          '00'.repeat(32) +
          '0700000000000000' +
          '6400000000000000' +
          '05',
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [wallet.toBase58(), false, false],
        [INSTRUCTIONS_SYSVAR, false, false],
      ]);
      expect(ctx.getWeb3Instructions().length).toBe(2);
    });

    test('ProgramExec token lock matches Rust builder', async () => {
      const ctx =
        await ProgramExecInstruction.addAuthorizationLockV1Instruction(
          {
            swig,
            payer,
            swigSystemAddress: wallet,
            assetAccount: tokenAccount,
            mint,
          },
          {
            authorityData: programExecAuthorityData,
            actingRoleId: 2,
            amount: 7n,
            expirySlot: 100n,
          },
          programExecOptions(),
        );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1900000002000000' +
          '05'.repeat(32) +
          '06'.repeat(32) +
          '0700000000000000' +
          '6400000000000000' +
          '06',
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [tokenAccount.toBase58(), false, false],
        [mint.toBase58(), false, false],
        [INSTRUCTIONS_SYSVAR, false, false],
      ]);
    });

    test('ProgramExec requires the preceding instruction to bind the wallet address', async () => {
      const options = programExecOptions();
      options.preInstructions[0].accounts[1] = SolAccountMeta.readonly(payer);
      await expect(
        ProgramExecInstruction.addAuthorizationLockV1Instruction(
          { swig, payer, swigSystemAddress: wallet, assetAccount: wallet },
          {
            authorityData: programExecAuthorityData,
            actingRoleId: 2,
            amount: 7n,
            expirySlot: 100n,
          },
          options,
        ),
      ).rejects.toThrow('swigSystemAddress');
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
        { swig, swigSystemAddress: wallet, payer },
        { authorityData: authority.toBytes(), actingRoleId: 2, lockId: 9 },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe('1a00000002000000090000000000000004');
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [authority.toBase58(), false, true],
      ]);
    });

    test('Ed25519 with rent claimer matches Rust builder', async () => {
      const ctx = await Ed25519Instruction.removeAuthorizationLockV1Instruction(
        { swig, swigSystemAddress: wallet, payer, rentClaimer },
        {
          authorityData: authority.toBytes(),
          actingRoleId: 2,
          lockId: 0xdeadbeef,
        },
      );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe('1a00000002000000efbeadde0000000005');
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [rentClaimer.toBase58(), true, false],
        [authority.toBase58(), false, true],
      ]);
    });

    test('Secp256k1 with rent claimer matches Rust builder', async () => {
      const ctx =
        await Secp256k1Instruction.removeAuthorizationLockV1Instruction(
          { swig, swigSystemAddress: wallet, payer, rentClaimer },
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
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [rentClaimer.toBase58(), true, false],
      ]);
    });

    test('Secp256r1 without rent claimer matches Rust builder', async () => {
      const ctx =
        await Secp256r1Instruction.removeAuthorizationLockV1Instruction(
          { swig, swigSystemAddress: wallet, payer },
          { authorityData: r1PublicKey, actingRoleId: 1, lockId: 3 },
          { signingFn: r1SigningFn, currentSlot: 500n, odometer: 1 },
        );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe(
        '1a000000010000000300000000000000' +
          'f401000000000000' +
          '01000000' +
          '04' +
          '00000000',
      );
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [INSTRUCTIONS_SYSVAR, false, false],
      ]);
    });

    test('ProgramExec without rent claimer matches Rust builder', async () => {
      const ctx =
        await ProgramExecInstruction.removeAuthorizationLockV1Instruction(
          { swig, swigSystemAddress: wallet, payer },
          {
            authorityData: programExecAuthorityData,
            actingRoleId: 2,
            lockId: 9,
          },
          programExecOptions(),
        );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe('1a00000002000000090000000000000004');
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [INSTRUCTIONS_SYSVAR, false, false],
      ]);
    });

    test('ProgramExec with rent claimer matches Rust builder', async () => {
      const ctx =
        await ProgramExecInstruction.removeAuthorizationLockV1Instruction(
          { swig, swigSystemAddress: wallet, payer, rentClaimer },
          {
            authorityData: programExecAuthorityData,
            actingRoleId: 2,
            lockId: 9,
          },
          programExecOptions(),
        );
      const ix = ctx.swigInstruction;

      expect(hex(ix.data)).toBe('1a00000002000000090000000000000005');
      expect(metas(ix)).toEqual([
        [swig.toBase58(), true, false],
        [wallet.toBase58(), false, false],
        [payer.toBase58(), true, true],
        [SYSTEM_PROGRAM, false, false],
        [rentClaimer.toBase58(), true, false],
        [INSTRUCTIONS_SYSVAR, false, false],
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
