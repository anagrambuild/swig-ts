/**
 * Tests for compactInstruction - Instruction compaction for Swig transactions
 *
 * Tests focus on the p-token #138 SyncNative breaking change combined with
 * the solana-labs/solana#9711 unbalanced-CPI workaround:
 * - SyncNative instructions must have exactly 1 account (wSOL ATA) when no
 *   transfer precedes them.
 * - When a SystemProgram.transfer precedes SyncNative, handleUnbalanced
 *   appends the swig account for lamport tracking.  p-token #138 requires
 *   the 2nd account to be the Rent sysvar, so the final account list is
 *   [wSOL ATA, Rent, swigAccount].
 */

import { describe, expect, test } from 'bun:test';
import {
  compactInstructions,
  SolAccountMeta,
  SolInstruction,
  SolPublicKey,
} from '../../src';

const SYSTEM_PROGRAM_ADDRESS_STRING = '11111111111111111111111111111111';
const TOKEN_PROGRAM_ADDRESS_STRING =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SYSVAR_RENT_ADDRESS_STRING =
  'SysvarRent111111111111111111111111111111111';

function mockSolPublicKey(byte: number): SolPublicKey {
  return new SolPublicKey(Uint8Array.from(Array(32).fill(byte)));
}

describe('compactInstructions', () => {
  test('sanitizes SyncNative to exactly one account when no transfer precedes it', () => {
    const swigAccount = mockSolPublicKey(1);
    const wsolAta = mockSolPublicKey(2);
    const extraAccount = mockSolPublicKey(3);

    const baseAccounts = [
      SolAccountMeta.readonly(swigAccount),
      SolAccountMeta.writable(wsolAta),
    ];

    const syncNativeIx = new SolInstruction({
      program: new SolPublicKey(TOKEN_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([17]), // SyncNative discriminator
      accounts: [
        SolAccountMeta.writable(wsolAta),
        SolAccountMeta.readonly(extraAccount), // extra account that should be stripped
      ],
    });

    const { accounts, compactIxs } = compactInstructions(
      swigAccount,
      [...baseAccounts],
      [syncNativeIx],
    );

    expect(compactIxs.length).toBe(1);
    // The compact instruction should reference exactly 1 account
    expect(compactIxs[0].accounts.length).toBe(1);

    // That account should be the wSOL ATA
    const wsolAtaIndex = compactIxs[0].accounts[0];
    expect(accounts[wsolAtaIndex].publicKey.toBase58()).toBe(
      wsolAta.toBase58(),
    );
  });

  test('SyncNative after SystemProgram transfer gets Rent + swig account', () => {
    const swigAccount = mockSolPublicKey(1);
    const payer = mockSolPublicKey(2);
    const wsolAta = mockSolPublicKey(3);

    const baseAccounts = [
      SolAccountMeta.writableSigner(payer),
      SolAccountMeta.readonly(swigAccount),
    ];

    const transferIx = new SolInstruction({
      program: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([2, 0, 0, 0]), // Transfer discriminator
      accounts: [
        SolAccountMeta.writable(payer),
        SolAccountMeta.writable(wsolAta),
      ],
    });

    const syncNativeIx = new SolInstruction({
      program: new SolPublicKey(TOKEN_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([17]),
      accounts: [SolAccountMeta.writable(wsolAta)],
    });

    const { accounts, compactIxs } = compactInstructions(
      swigAccount,
      [...baseAccounts],
      [transferIx, syncNativeIx],
    );

    expect(compactIxs.length).toBe(2);

    // The SyncNative compact instruction should have 3 accounts:
    // wSOL ATA, Rent sysvar, swigAccount
    const syncNativeCompact = compactIxs[1];
    expect(syncNativeCompact.accounts.length).toBe(3);

    // Account 0 = wSOL ATA
    expect(accounts[syncNativeCompact.accounts[0]].publicKey.toBase58()).toBe(
      wsolAta.toBase58(),
    );
    // Account 1 = Rent sysvar
    expect(accounts[syncNativeCompact.accounts[1]].publicKey.toBase58()).toBe(
      SYSVAR_RENT_ADDRESS_STRING,
    );
    // Account 2 = swigAccount
    expect(accounts[syncNativeCompact.accounts[2]].publicKey.toBase58()).toBe(
      swigAccount.toBase58(),
    );
  });

  test('non-SyncNative after SystemProgram transfer gets swig account once', () => {
    const swigAccount = mockSolPublicKey(1);
    const payer = mockSolPublicKey(2);
    const recipient = mockSolPublicKey(3);

    const baseAccounts = [
      SolAccountMeta.writableSigner(payer),
      SolAccountMeta.readonly(swigAccount),
    ];

    const transferIx = new SolInstruction({
      program: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([2, 0, 0, 0]),
      accounts: [
        SolAccountMeta.writable(payer),
        SolAccountMeta.writable(recipient),
      ],
    });

    const anotherTransferIx = new SolInstruction({
      program: new SolPublicKey(SYSTEM_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([2, 0, 0, 0]),
      accounts: [
        SolAccountMeta.writable(payer),
        SolAccountMeta.writable(recipient),
      ],
    });

    const { accounts, compactIxs } = compactInstructions(
      swigAccount,
      [...baseAccounts],
      [transferIx, anotherTransferIx],
    );

    expect(compactIxs.length).toBe(2);

    // The second transfer should have its 2 original accounts + swig account
    expect(compactIxs[1].accounts.length).toBe(3);

    // Verify the swig account is included
    const swigAccountIndex = compactIxs[1].accounts[2];
    expect(accounts[swigAccountIndex].publicKey.toBase58()).toBe(
      swigAccount.toBase58(),
    );
  });

  test('recognizes SyncNative by discriminator and program ID', () => {
    const swigAccount = mockSolPublicKey(1);
    const wsolAta = mockSolPublicKey(2);

    // Not SyncNative: wrong data length
    const notSyncNative1 = new SolInstruction({
      program: new SolPublicKey(TOKEN_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([17, 0]),
      accounts: [
        SolAccountMeta.writable(wsolAta),
        SolAccountMeta.readonly(mockSolPublicKey(3)),
      ],
    });

    // Not SyncNative: wrong discriminator
    const notSyncNative2 = new SolInstruction({
      program: new SolPublicKey(TOKEN_PROGRAM_ADDRESS_STRING),
      data: Uint8Array.from([16]),
      accounts: [
        SolAccountMeta.writable(wsolAta),
        SolAccountMeta.readonly(mockSolPublicKey(3)),
      ],
    });

    const { compactIxs: ixs1 } = compactInstructions(
      swigAccount,
      [SolAccountMeta.readonly(swigAccount)],
      [notSyncNative1],
    );
    expect(ixs1[0].accounts.length).toBe(2); // not sanitized

    const { compactIxs: ixs2 } = compactInstructions(
      swigAccount,
      [SolAccountMeta.readonly(swigAccount)],
      [notSyncNative2],
    );
    expect(ixs2[0].accounts.length).toBe(2); // not sanitized
  });
});
