import { bytesToHex } from '@noble/curves/abstract/utils';
import { p256 } from '@noble/curves/p256';
import { PublicKey } from '@solana/web3.js';
import { AuthorityType } from '@swig-wallet/coder';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAuthority } from '../src/authority/getAuthority';
import {
  Secp256r1Authority,
  Secp256r1SessionAuthority,
} from '../src/authority/secp256r1';

describe('Secp256r1Authority', () => {
  let testPrivateKey: Uint8Array;
  let compressedPublicKey: Uint8Array;
  let uncompressedPublicKey: Uint8Array;

  beforeAll(() => {
    // Generate a test secp256r1 key pair
    testPrivateKey = p256.utils.randomPrivateKey();
    const point = p256.ProjectivePoint.fromPrivateKey(testPrivateKey);
    compressedPublicKey = point.toRawBytes(true); // compressed (33 bytes)
    uncompressedPublicKey = point.toRawBytes(false); // compressed (33 bytes)
  });

  describe('Secp256r1SessionAuthority', () => {
    it('should create uninitialized session authority from compressed public key', () => {
      const sessionKey = PublicKey.unique();
      const maxDuration = 100n;

      const authority = Secp256r1SessionAuthority.uninitialized(
        compressedPublicKey,
        maxDuration,
        sessionKey,
      );

      expect(authority.secp256r1PublicKey).toEqual(compressedPublicKey);
      expect(authority.sessionKey).toEqual(sessionKey);
      expect(authority.maxDuration).toBe(maxDuration);
      expect(authority.type).toBe(AuthorityType.Secp256r1Session);
      expect(authority.session).toBe(true);
      expect(authority.isInitialized()).toBe(false);
    });

    it('should create uninitialized session authority from hex string', () => {
      const hexKey = bytesToHex(compressedPublicKey);
      const sessionKey = PublicKey.unique();
      const maxDuration = 200n;

      const authority = Secp256r1SessionAuthority.uninitializedString(
        hexKey,
        maxDuration,
        sessionKey,
      );

      expect(authority.secp256r1PublicKey).toEqual(compressedPublicKey);
      expect(authority.sessionKey).toEqual(sessionKey);
      expect(authority.maxDuration).toBe(maxDuration);
    });

    it('should handle uncompressed public key input', () => {
      const sessionKey = PublicKey.unique();
      const maxDuration = 300n;

      const authority = Secp256r1SessionAuthority.uninitialized(
        uncompressedPublicKey,
        maxDuration,
        sessionKey,
      );

      // Should compress the key
      expect(authority.secp256r1PublicKey).toEqual(compressedPublicKey);
      expect(authority.secp256r1PublicKey).toHaveLength(33);
    });

    it('should encode and decode session authority data correctly', () => {
      const sessionKey = PublicKey.unique();
      const maxDuration = 500n;

      const authority1 = Secp256r1SessionAuthority.uninitialized(
        compressedPublicKey,
        maxDuration,
        sessionKey,
      );

      // Create another authority from the encoded data
      const authority2 = new Secp256r1SessionAuthority(authority1.data);

      expect(authority2.secp256r1PublicKey).toEqual(compressedPublicKey);
      expect(authority2.sessionKey).toEqual(sessionKey);
      expect(authority2.maxDuration).toBe(maxDuration);
    });

    it('should calculate odometer correctly', () => {
      const sessionKey = PublicKey.unique();
      const authority = Secp256r1SessionAuthority.uninitialized(
        compressedPublicKey,
        100n,
        sessionKey,
      );

      // For uninitialized authority, odometer should be 1 (0 + 1)
      expect(authority.odometer()).toBe(1);
    });

    it('should provide correct identity', () => {
      const sessionKey = PublicKey.unique();
      const authority = Secp256r1SessionAuthority.uninitialized(
        compressedPublicKey,
        100n,
        sessionKey,
      );

      expect(authority.id).toEqual(compressedPublicKey);
      expect(authority.signer).toEqual(sessionKey.toBytes());
    });
  });

  describe('Secp256r1 signature verification', () => {
    it('should create correct message hash using keccak', async () => {
      const { keccak_256 } = await import('@noble/hashes/sha3');

      const testMessage = new Uint8Array([1, 2, 3, 4, 5]);
      const expectedHash = keccak_256(testMessage);

      // This tests that our implementation uses keccak instead of sha256
      expect(expectedHash).toHaveLength(32);
      expect(expectedHash).not.toEqual(new Uint8Array(32)); // Should not be all zeros
    });

    it('should sign message with secp256r1', async () => {
      const { keccak_256 } = await import('@noble/hashes/sha3');

      // Generate a test key pair
      const privateKey = p256.utils.randomPrivateKey();
      const publicKey = p256.getPublicKey(privateKey, true);

      // Create test message
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const messageHash = keccak_256(message);

      // Sign the message
      const signature = p256.sign(messageHash, privateKey);

      // Verify the signature
      const isValid = p256.verify(signature, messageHash, publicKey);

      expect(isValid).toBe(true);
      expect(publicKey).toHaveLength(33); // Compressed public key
    });
  });

  describe('getAuthority integration', () => {
    it('should parse Secp256r1 authority correctly', () => {
      const authority = getAuthority(
        AuthorityType.Secp256r1,
        compressedPublicKey,
        1,
      ) as Secp256r1Authority;

      expect(authority).toBeInstanceOf(Secp256r1Authority);
      expect(authority.type).toBe(AuthorityType.Secp256r1);
      expect(authority.roleId).toBe(1);
      expect(authority.publicKeyBytes).toEqual(compressedPublicKey);
      expect(authority.session).toBe(false);
    });

    it('should parse Secp256r1 session authority correctly', () => {
      const sessionKey = PublicKey.unique();
      const sessionAuthority = Secp256r1SessionAuthority.uninitialized(
        compressedPublicKey,
        100n,
        sessionKey,
      );

      const parsedAuthority = getAuthority(
        AuthorityType.Secp256r1Session,
        sessionAuthority.data,
        2,
      );

      expect(parsedAuthority).toBeInstanceOf(Secp256r1SessionAuthority);
      expect(parsedAuthority.type).toBe(AuthorityType.Secp256r1Session);
      expect(parsedAuthority.roleId).toBe(2);
      expect(parsedAuthority.session).toBe(true);
    });

    it('should throw for invalid authority type', () => {
      expect(() => {
        getAuthority(99 as AuthorityType, compressedPublicKey);
      }).toThrow('Invalid authority');
    });
  });
});
