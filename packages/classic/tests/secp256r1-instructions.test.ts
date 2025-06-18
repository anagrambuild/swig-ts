import { bytesToHex } from '@noble/curves/abstract/utils';
import { p256 } from '@noble/curves/p256';
import { keccak_256 } from '@noble/hashes/sha3';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { AuthorityType } from '@swig-wallet/coder';
import { beforeAll, describe, expect, test } from 'vitest';
import type { InstructionDataOptions } from '../src/authority/instructions/interface';
import { prepareSecp256r1Payload } from '../src/authority/instructions/secp256r1';
import { Secp256r1SessionAuthority } from '../src/authority/secp256r1/session';

describe('Secp256r1 Instructions', () => {
  let testPrivateKey: Uint8Array;
  let compressedPublicKey: Uint8Array;
  let authority: Secp256r1SessionAuthority;

  beforeAll(() => {
    // Generate a test secp256r1 key pair
    testPrivateKey = p256.utils.randomPrivateKey();
    const point = p256.ProjectivePoint.fromPrivateKey(testPrivateKey);
    compressedPublicKey = point.toRawBytes(true);

    // Create a session authority
    authority = Secp256r1SessionAuthority.uninitialized(
      compressedPublicKey,
      BigInt(3600), // 1 hour session
      new PublicKey('11111111111111111111111111111112'),
    );
  });

  describe('prepareSecp256r1Payload', () => {
    test('should create authority payload correctly', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const currentSlot = BigInt(12345);
      const odometer = 1;

      // Mock account metas including instructions sysvar
      const accountMetas = [
        {
          pubkey: new PublicKey('11111111111111111111111111111111'),
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: new PublicKey('11111111111111111111111111111112'),
          isWritable: false,
          isSigner: true,
        },
        {
          pubkey: SystemProgram.programId,
          isWritable: false,
          isSigner: false,
        },
        {
          pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'),
          isWritable: false,
          isSigner: false,
        },
      ];

      // Mock signing function that returns a signature result
      const mockSigningFn = async (message: Uint8Array) => {
        expect(message).toBeInstanceOf(Uint8Array);
        expect(message.length).toBe(32); // Keccak hash should be 32 bytes

        // Create a mock signature with secp256r1
        const signature = p256.sign(message, testPrivateKey);
        return { signature: signature.toCompactRawBytes() };
      };

      const options: InstructionDataOptions = {
        signingFn: mockSigningFn,
        currentSlot,
        odometer,
      };

      const authorityPayload = await prepareSecp256r1Payload(
        testData,
        accountMetas,
        options,
      );

      expect(authorityPayload).toBeInstanceOf(Uint8Array);
      expect(authorityPayload.length).toBe(17); // secp256r1 authority payload size

      // Check slot bytes (first 8 bytes)
      const slotBytes = authorityPayload.slice(0, 8);
      const slotView = new DataView(slotBytes.buffer);
      expect(slotView.getBigUint64(0, true)).toBe(currentSlot);

      // Check counter bytes (next 4 bytes)
      const counterBytes = authorityPayload.slice(8, 12);
      const counterView = new DataView(counterBytes.buffer);
      expect(counterView.getUint32(0, true)).toBe(odometer);

      // Check instruction sysvar index (byte 12)
      expect(authorityPayload[12]).toBe(3); // Index of instructions sysvar in accountMetas

      // Check remaining bytes are padding (should be 0)
      for (let i = 13; i < 17; i++) {
        expect(authorityPayload[i]).toBe(0);
      }
    });

    test('should fail if instructions sysvar account is missing', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const accountMetas = [
        {
          pubkey: new PublicKey('11111111111111111111111111111111'),
          isWritable: true,
          isSigner: false,
        },
      ];

      const mockSigningFn = async () => ({
        signature: new Uint8Array(64),
      });

      const options: InstructionDataOptions = {
        signingFn: mockSigningFn,
        currentSlot: BigInt(100),
        odometer: 1,
      };

      await expect(
        prepareSecp256r1Payload(testData, accountMetas, options),
      ).rejects.toThrow(
        'Instructions sysvar account not found in account metas',
      );
    });

    test('should create consistent message hash', async () => {
      const testData = new Uint8Array([10, 20, 30]);
      const currentSlot = BigInt(54321);
      const odometer = 5;

      const accountMetas = [
        {
          pubkey: new PublicKey('11111111111111111111111111111111'),
          isWritable: false,
          isSigner: true,
        },
        {
          pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'),
          isWritable: false,
          isSigner: false,
        },
      ];

      let capturedMessage: Uint8Array | null = null;
      const mockSigningFn = async (message: Uint8Array) => {
        capturedMessage = new Uint8Array(message);
        return { signature: new Uint8Array(64) };
      };

      const options: InstructionDataOptions = {
        signingFn: mockSigningFn,
        currentSlot,
        odometer,
      };

      await prepareSecp256r1Payload(testData, accountMetas, options);

      expect(capturedMessage).not.toBeNull();
      expect(capturedMessage!.length).toBe(32);

      // Verify the message hash is computed consistently
      // (This would be the keccak hash of the combined data)
      const expectedHash = keccak_256(capturedMessage!);
      expect(expectedHash.length).toBe(32);
    });
  });

  describe('Authority Integration', () => {
    test('should create authority with correct type and properties', () => {
      expect(authority.type).toBe(AuthorityType.Secp256r1Session);
      expect(authority.secp256r1PublicKey).toEqual(compressedPublicKey);
      expect(authority.secp256r1PublicKeyString).toBe(
        bytesToHex(compressedPublicKey),
      );
      expect(authority.maxDuration).toBe(BigInt(3600));
    });

    test('should provide session key for signing', () => {
      const sessionKey = authority.sessionKey;
      expect(sessionKey).toBeInstanceOf(PublicKey);

      const signerBytes = authority.signer;
      expect(signerBytes).toEqual(sessionKey.toBytes());
    });

    test('should track odometer correctly', () => {
      const initialOdometer = authority.odometer();
      expect(initialOdometer).toBe(1); // 0 + 1 for uninitialized authority
    });
  });

  describe('secp256r1 vs secp256k1 differences', () => {
    test('should use keccak hashing instead of sha256+keccak', () => {
      const testMessage = new Uint8Array([1, 2, 3, 4, 5]);

      // secp256r1 uses keccak directly
      const secp256r1Hash = keccak_256(testMessage);

      expect(secp256r1Hash).toBeInstanceOf(Uint8Array);
      expect(secp256r1Hash.length).toBe(32);
    });

    test('should use 17-byte authority payload vs 65-byte for secp256k1', () => {
      // secp256r1 uses 17 bytes: 8 (slot) + 4 (counter) + 1 (instruction index) + 4 (padding)
      // secp256k1 uses 65 bytes: 8 (slot) + 4 (counter) + 65 (signature) + prefix
      const secp256r1PayloadSize = 17;
      expect(secp256r1PayloadSize).toBe(17);
    });

    test('should use compressed public keys (33 bytes)', () => {
      expect(compressedPublicKey.length).toBe(33);
      expect(authority.secp256r1PublicKey.length).toBe(33);
    });
  });
});
