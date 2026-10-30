/**
 * Tests for the swig tail decoder (authorization locks, rent claimer)
 *
 * Each tail entry is `[kind u8][version u8][valueLen u16][payload 4]` followed
 * by `valueLen` bytes. Lock entries are kind 3, version 1, payload
 * `nextLockId` u32, value N x 88-byte locks.
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  decodeAuthorizationLocks,
  decodeRentClaimer,
  decodeSwigTail,
  findSwigPdaRaw,
  getActiveAuthorizationLocks,
  getCreateSwigInstructionContext,
  getSwigAuthorizationLocks,
  getSwigCodec,
  getSwigTail,
  isAuthorizationLockActive,
  isNativeSolAuthorizationLock,
  SolPublicKey,
  Swig,
} from '../../src';
import { getFundedKeys, getSvm } from '../context';
import { randomBytes, sendSwigSVMTransaction, toPublicKey } from '../helpers';

function entry(
  kind: number,
  version: number,
  payload: number[],
  value: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(8 + value.length);
  const view = new DataView(out.buffer);
  out[0] = kind;
  out[1] = version;
  view.setUint16(2, value.length, true);
  out.set(payload, 4);
  out.set(value, 8);
  return out;
}

function lock(args: {
  asset: number;
  mint: number;
  amount: bigint;
  expirySlot: bigint;
  roleId: number;
  lockId: number;
}): Uint8Array {
  const out = new Uint8Array(88);
  const view = new DataView(out.buffer);
  out.fill(args.asset, 0, 32);
  out.fill(args.mint, 32, 64);
  view.setBigUint64(64, args.amount, true);
  view.setBigUint64(72, args.expirySlot, true);
  view.setUint32(80, args.roleId, true);
  view.setUint32(84, args.lockId, true);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const solLock = lock({
  asset: 4,
  mint: 0,
  amount: 1_000n,
  expirySlot: 100n,
  roleId: 0,
  lockId: 0,
});
const tokenLock = lock({
  asset: 5,
  mint: 6,
  amount: 0x0102030405060708n,
  expirySlot: 200n,
  roleId: 1,
  lockId: 2,
});

const mixedTail = concat(
  entry(1, 1, [0, 0, 0, 0], new Uint8Array(32).fill(7)),
  entry(2, 1, [0, 0, 0, 0], Uint8Array.from([3, 0, 0, 0])),
  entry(3, 1, [3, 0, 0, 0], concat(solLock, tokenLock)),
  entry(4, 1, [0, 0, 0, 0], Uint8Array.from([0xaa, 0xbb])),
  // unknown kind, skipped by length
  entry(9, 1, [1, 2, 3, 4], Uint8Array.from([1, 2, 3])),
);

describe('swig tail', () => {
  test('decodeSwigTail splits mixed entries by length', () => {
    const entries = decodeSwigTail(mixedTail);
    expect(entries.map((e) => e.header.kind)).toEqual([1, 2, 3, 4, 9]);
    expect(entries.map((e) => e.value.length)).toEqual([32, 4, 176, 2, 3]);
  });

  test('decodeAuthorizationLocks skips other entries', () => {
    const { nextLockId, locks } = decodeAuthorizationLocks(mixedTail);
    expect(nextLockId).toBe(3);
    expect(locks.length).toBe(2);

    expect(Array.from(locks[0].assetAccount)).toEqual(Array(32).fill(4));
    expect(Array.from(locks[0].mint)).toEqual(Array(32).fill(0));
    expect(locks[0].amount).toBe(1_000n);
    expect(locks[0].expirySlot).toBe(100n);
    expect(locks[0].roleId).toBe(0);
    expect(locks[0].lockId).toBe(0);
    expect(isNativeSolAuthorizationLock(locks[0])).toBe(true);

    expect(Array.from(locks[1].assetAccount)).toEqual(Array(32).fill(5));
    expect(Array.from(locks[1].mint)).toEqual(Array(32).fill(6));
    expect(locks[1].amount).toBe(0x0102030405060708n);
    expect(locks[1].expirySlot).toBe(200n);
    expect(locks[1].roleId).toBe(1);
    expect(locks[1].lockId).toBe(2);
    expect(isNativeSolAuthorizationLock(locks[1])).toBe(false);
  });

  test('active locks are those with currentSlot < expirySlot', () => {
    const decoded = decodeAuthorizationLocks(mixedTail);
    expect(getActiveAuthorizationLocks(decoded, 99n).length).toBe(2);
    expect(
      getActiveAuthorizationLocks(decoded, 100n).map((l) => l.lockId),
    ).toEqual([2]);
    expect(getActiveAuthorizationLocks(decoded.locks, 200n)).toEqual([]);
    expect(isAuthorizationLockActive(decoded.locks[1], 199n)).toBe(true);
    expect(isAuthorizationLockActive(decoded.locks[1], 200n)).toBe(false);
  });

  test('returns no locks when the tail has no lock entry', () => {
    expect(decodeAuthorizationLocks(new Uint8Array(0))).toEqual({
      nextLockId: 0,
      locks: [],
    });
    const noLocks = concat(
      entry(1, 1, [0, 0, 0, 0], new Uint8Array(32).fill(7)),
    );
    expect(decodeAuthorizationLocks(noLocks)).toEqual({
      nextLockId: 0,
      locks: [],
    });
  });

  test('keeps nextLockId when every lock was removed', () => {
    const tail = entry(3, 1, [5, 0, 0, 0], new Uint8Array(0));
    expect(decodeAuthorizationLocks(tail)).toEqual({
      nextLockId: 5,
      locks: [],
    });
  });

  test('rejects malformed lock entries', () => {
    expect(() =>
      decodeAuthorizationLocks(entry(3, 2, [0, 0, 0, 0], solLock)),
    ).toThrow('version');
    expect(() =>
      decodeAuthorizationLocks(
        entry(3, 1, [0, 0, 0, 0], solLock.subarray(0, 87)),
      ),
    ).toThrow('length');
    expect(() => decodeSwigTail(mixedTail.subarray(0, 5))).toThrow('truncated');
    expect(() =>
      decodeSwigTail(mixedTail.subarray(0, mixedTail.length - 1)),
    ).toThrow('truncated');
  });

  test('decodeRentClaimer reads the rent claimer entry', () => {
    expect(decodeRentClaimer(mixedTail)?.toBase58()).toBe(
      new SolPublicKey(new Uint8Array(32).fill(7)).toBase58(),
    );
    expect(decodeRentClaimer(new Uint8Array(0))).toBeNull();
  });

  test('reads the tail after the roles of a swig account', async () => {
    const svm = getSvm();
    const [payer] = getFundedKeys(svm, 1);
    const swigId = randomBytes(32);
    const [swigAddress] = await findSwigPdaRaw(swigId);

    const createIx = await getCreateSwigInstructionContext({
      authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSwigSVMTransaction(svm, createIx, payer);

    const account = getSwigCodec().decode(
      Uint8Array.from(svm.getAccount(toPublicKey(swigAddress))!.data),
    );
    const withTail = {
      ...account,
      roles_buffer: concat(Uint8Array.from(account.roles_buffer), mixedTail),
    };

    expect(Array.from(getSwigTail(account))).toEqual([]);
    expect(Array.from(getSwigTail(withTail))).toEqual(Array.from(mixedTail));
    expect(getSwigAuthorizationLocks(withTail).nextLockId).toBe(3);

    const swig = new Swig(swigAddress, withTail);
    expect(swig.roles.length).toBe(1);
    expect(swig.authorizationLocks().locks.length).toBe(2);
    expect(swig.activeAuthorizationLocks(150n).map((l) => l.lockId)).toEqual([
      2,
    ]);
    expect(swig.rentClaimer()?.toBase58()).toBe(
      new SolPublicKey(new Uint8Array(32).fill(7)).toBase58(),
    );
  });
});
