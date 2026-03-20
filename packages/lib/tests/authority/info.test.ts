/**
 * Tests for AuthorityInfo.address() and AuthorityInfo.addressString()
 */

import { bytesToHex } from '@noble/curves/abstract/utils';
import { AuthorityType } from '@swig-wallet/coder';
import {
  Actions,
  AuthorityInfo,
  findSwigPdaRaw,
  getCreateSwigInstructionContext,
  SolPublicKey,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import {
  generateTestKeypair,
  randomBytes,
  sendSwigSVMTransaction,
} from '../helpers';

describe('AuthorityInfo', () => {
  describe('address()', () => {
    test('Ed25519 returns id bytes as-is', () => {
      const keypair = generateTestKeypair();
      const pubkeyBytes = new SolPublicKey(keypair.address).toBytes();
      const info = new AuthorityInfo(AuthorityType.Ed25519, pubkeyBytes);

      const address = info.address();

      expect(Array.from(address)).toEqual(Array.from(pubkeyBytes));
    });

    test('Secp256k1 with compressed key returns 20-byte address', () => {
      const authority = createTestSecp256k1Authority();
      // authority.authorityInfo.data is the compressed pubkey (33 bytes)
      const info = new AuthorityInfo(
        AuthorityType.Secp256k1,
        authority.authorityInfo.data,
      );

      const address = info.address();

      expect(address).toBeInstanceOf(Uint8Array);
      expect(address.length).toBe(20);
    });

    test('Secp256k1 compressed and uncompressed produce same address', () => {
      const authority = createTestSecp256k1Authority();
      // authority.publicKey from @ethereumjs/wallet is uncompressed (64 bytes)
      const uncompressedInfo = new AuthorityInfo(
        AuthorityType.Secp256k1,
        authority.publicKey,
      );

      const address = uncompressedInfo.address();
      expect(address.length).toBe(20);
      expect(Array.from(address)).toEqual(Array.from(authority.address));
    });

    test('Secp256r1 returns id bytes as-is', () => {
      const authority = createTestSecp256r1Authority();
      const info = new AuthorityInfo(
        AuthorityType.Secp256r1,
        authority.compressedPublicKey,
      );

      const address = info.address();

      expect(Array.from(address)).toEqual(
        Array.from(authority.compressedPublicKey),
      );
    });

    test('Secp256k1 address matches on-chain authority.address', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const onChainAuthority = swig.roles[0].authority;

      const info = new AuthorityInfo(
        AuthorityType.Secp256k1,
        authority.authorityInfo.data,
      );
      const infoAddress = info.address();

      expect(Array.from(infoAddress)).toEqual(
        Array.from(onChainAuthority.address),
      );
    });
  });

  describe('addressString()', () => {
    test('Ed25519 returns base58', () => {
      const keypair = generateTestKeypair();
      const pubkeyBytes = new SolPublicKey(keypair.address).toBytes();
      const info = new AuthorityInfo(AuthorityType.Ed25519, pubkeyBytes);

      expect(info.addressString()).toBe(keypair.address);
    });

    test('Secp256k1 returns unprefixed hex', () => {
      const authority = createTestSecp256k1Authority();
      const info = new AuthorityInfo(
        AuthorityType.Secp256k1,
        authority.authorityInfo.data,
      );

      const str = info.addressString();

      expect(str).toMatch(/^[0-9a-f]+$/i);
      expect(str).not.toMatch(/^0x/);
      expect(str.length).toBe(40); // 20 bytes = 40 hex chars
    });

    test('Secp256r1 returns unprefixed hex', () => {
      const authority = createTestSecp256r1Authority();
      const info = new AuthorityInfo(
        AuthorityType.Secp256r1,
        authority.compressedPublicKey,
      );

      const str = info.addressString();

      expect(str).toMatch(/^[0-9a-f]+$/i);
      expect(str).not.toMatch(/^0x/);
      expect(str).toBe(bytesToHex(authority.compressedPublicKey));
    });
  });
});
