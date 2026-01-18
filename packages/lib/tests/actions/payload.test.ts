/**
 * Tests for Action payload utilities
 *
 * Tests the payload decoding and type guard functions:
 * - decodeActionPayload for various permission types
 * - isActionPayload type guard
 */

import { Keypair } from '@solana/web3.js';
import { Permission } from '@swig-wallet/coder';
import {
  type ActionPayload,
  decodeActionPayload,
  isActionPayload,
} from '../../src/actions/payload';

describe('Action payload utilities', () => {
  // ============================================================================
  // decodeActionPayload
  // ============================================================================

  describe('decodeActionPayload', () => {
    test('decodes All permission', () => {
      const payload = decodeActionPayload(Permission.All, new Uint8Array(0));
      expect(payload.permission).toBe(Permission.All);
    });

    test('decodes ManageAuthority permission', () => {
      const payload = decodeActionPayload(
        Permission.ManageAuthority,
        new Uint8Array(0),
      );
      expect(payload.permission).toBe(Permission.ManageAuthority);
    });

    test('decodes AllButManageAuthority permission', () => {
      const payload = decodeActionPayload(
        Permission.AllButManageAuthority,
        new Uint8Array(0),
      );
      expect(payload.permission).toBe(Permission.AllButManageAuthority);
    });

    test('decodes ProgramAll permission', () => {
      const payload = decodeActionPayload(
        Permission.ProgramAll,
        new Uint8Array(0),
      );
      expect(payload.permission).toBe(Permission.ProgramAll);
    });

    test('decodes StakeAll permission', () => {
      const payload = decodeActionPayload(
        Permission.StakeAll,
        new Uint8Array(0),
      );
      expect(payload.permission).toBe(Permission.StakeAll);
    });

    test('decodes SolLimit permission with data', () => {
      // SolLimit is 8 bytes (u64 amount)
      const data = new Uint8Array(8);
      const view = new DataView(data.buffer);
      view.setBigUint64(0, 1_000_000n, true); // little endian

      const payload = decodeActionPayload(Permission.SolLimit, data);
      expect(payload.permission).toBe(Permission.SolLimit);
      if (payload.permission === Permission.SolLimit) {
        expect(payload.data.amount).toBe(1_000_000n);
      }
    });

    test('decodes Program permission with data', () => {
      // Program is 32 bytes (program ID)
      const programId = Keypair.generate().publicKey.toBytes();
      const payload = decodeActionPayload(Permission.Program, programId);

      expect(payload.permission).toBe(Permission.Program);
      if (payload.permission === Permission.Program) {
        expect(Array.from(new Uint8Array(payload.data.programId))).toEqual(
          Array.from(programId),
        );
      }
    });

    test('throws for invalid permission', () => {
      expect(() =>
        decodeActionPayload(999 as Permission, new Uint8Array(0)),
      ).toThrow('Invalid Permission');
    });
  });

  // ============================================================================
  // isActionPayload type guard
  // ============================================================================

  describe('isActionPayload', () => {
    test('returns true for matching permission', () => {
      const payload = decodeActionPayload(Permission.All, new Uint8Array(0));
      expect(isActionPayload(Permission.All, payload)).toBe(true);
    });

    test('returns false for non-matching permission', () => {
      const payload = decodeActionPayload(Permission.All, new Uint8Array(0));
      expect(isActionPayload(Permission.ManageAuthority, payload)).toBe(false);
    });

    test('type guard narrows payload type correctly', () => {
      // SolLimit data
      const data = new Uint8Array(8);
      const view = new DataView(data.buffer);
      view.setBigUint64(0, 1_000_000n, true);

      const payload = decodeActionPayload(Permission.SolLimit, data);

      if (isActionPayload(Permission.SolLimit, payload)) {
        // TypeScript should know payload has data property here
        expect(payload.data.amount).toBe(1_000_000n);
      } else {
        fail('isActionPayload should return true for SolLimit');
      }
    });

    test('works with all no-payload permissions', () => {
      const noPayloadPermissions = [
        Permission.All,
        Permission.ManageAuthority,
        Permission.AllButManageAuthority,
        Permission.ProgramAll,
        Permission.StakeAll,
      ];

      noPayloadPermissions.forEach((perm) => {
        const payload = decodeActionPayload(perm, new Uint8Array(0));
        expect(
          isActionPayload(perm as ActionPayload['permission'], payload),
        ).toBe(true);
      });
    });
  });

  // ============================================================================
  // Round-trip encoding/decoding
  // ============================================================================

  describe('Round-trip encoding/decoding', () => {
    test('SolLimit round-trips correctly', () => {
      const amount = 5_000_000_000n;
      const data = new Uint8Array(8);
      const view = new DataView(data.buffer);
      view.setBigUint64(0, amount, true);

      const payload = decodeActionPayload(Permission.SolLimit, data);
      if (isActionPayload(Permission.SolLimit, payload)) {
        expect(payload.data.amount).toBe(amount);
      } else {
        fail('Should be SolLimit payload');
      }
    });

    test('TokenLimit includes mint and amount', () => {
      // TokenLimit is 40 bytes: 32 (mint) + 8 (amount)
      const mint = Keypair.generate().publicKey.toBytes();
      const amount = 1_000_000n;

      const data = new Uint8Array(40);
      data.set(mint, 0);
      const view = new DataView(data.buffer);
      view.setBigUint64(32, amount, true);

      const payload = decodeActionPayload(Permission.TokenLimit, data);
      expect(payload.permission).toBe(Permission.TokenLimit);
      if (isActionPayload(Permission.TokenLimit, payload)) {
        expect(payload.data.amount).toBe(amount);
      }
    });
  });
});
