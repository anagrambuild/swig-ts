import { Keypair } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import { Swig } from '../../src/swig';

function swigWithVersionWindow(window: bigint): Swig {
  return new Swig(Keypair.generate().publicKey, {
    discriminator: 1,
    bump: 254,
    id: new Uint8Array(32),
    roles: 0,
    role_counter: 0,
    reserved_lamports_or_bump: window,
    roles_buffer: new Uint8Array(0),
  });
}

describe('Swig account generation', () => {
  test('keeps V2 after the sub-account counter becomes nonzero', () => {
    const swig = swigWithVersionWindow((7n << 32n) | 253n);
    expect(swig.accountVersion()).toBe('v2');
    expect(swig.subAccountV2Counter()).toBe(7);
  });

  test('rejects the common V1 rent reserve and zero bump', () => {
    const v1 = swigWithVersionWindow(890_880n);
    expect(v1.accountVersion()).toBe('v1');
    expect(v1.subAccountV2Counter()).toBeNull();
    expect(swigWithVersionWindow(0n).accountVersion()).toBe('v1');
  });
});
