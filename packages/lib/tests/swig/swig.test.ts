/**
 * Tests for Swig class
 *
 * Tests the Swig class methods:
 * - Properties (address, id, roles, accountVersion)
 * - Query methods (findRoleById, findRoleBySessionKey, findRolesByAuthoritySigner, etc.)
 * - Static methods (fromRawAccountData)
 */

import { Keypair } from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSessionInstructionContext,
  getCreateSwigInstructionContext,
  SolPublicKey,
  Swig,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestProgramExecAuthority,
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction } from '../helpers';

describe('Swig class', () => {
  // ============================================================================
  // Properties
  // ============================================================================

  describe('properties', () => {
    test('address returns correct swig address', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      expect(swig.address.toBase58()).toBe(
        new SolPublicKey(swigAddress).toBase58(),
      );
    });

    test('id returns swig ID', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      expect(Array.from(new Uint8Array(swig.id))).toEqual(Array.from(swigId));
    });

    test('roles returns deserialized roles', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      expect(swig.roles).toBeInstanceOf(Array);
      expect(swig.roles.length).toBe(1);
      expect(swig.roles[0].id).toBe(0);
    });

    test('accountVersion returns v2 for new accounts', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      // New accounts are V2 by default
      expect(swig.accountVersion()).toBe('v2');
    });

    test('accountAddress returns the swig address', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      expect(swig.accountAddress().toBase58()).toBe(
        new SolPublicKey(swigAddress).toBase58(),
      );
    });
  });

  // ============================================================================
  // Query methods
  // ============================================================================

  describe('findRoleById', () => {
    test('returns correct role for existing ID', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const role = swig.findRoleById(0);
      expect(role).toBeDefined();
      expect(role!.id).toBe(0);
    });

    test('returns null for non-existing ID', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const role = swig.findRoleById(999);
      expect(role).toBeNull();
    });
  });

  describe('findRoleBySessionKey', () => {
    test('returns role for matching session key', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const sessionKey = Keypair.generate();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with session authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(
          payer.publicKey,
          100n,
          new SolPublicKey(sessionKey.publicKey),
        ),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);

      // Create session to set the session key
      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.publicKey,
        100n,
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      // Refetch swig to get updated session
      const updatedSwig = fetchSwig(svm, swigAddress);

      const role = updatedSwig.findRoleBySessionKey(sessionKey.publicKey);
      expect(role).toBeDefined();
      expect(role!.isSessionBased()).toBe(true);
    });

    test('returns null for non-matching session key', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const randomKey = Keypair.generate().publicKey;
      const role = swig.findRoleBySessionKey(randomKey);
      expect(role).toBeNull();
    });
  });

  describe('findRolesByEd25519SignerPk', () => {
    test('finds roles by Ed25519 public key', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByEd25519SignerPk(payer.publicKey);
      expect(roles.length).toBe(1);
      expect(roles[0].id).toBe(0);
    });

    test('returns empty array for non-matching key', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const randomKey = Keypair.generate().publicKey;
      const roles = swig.findRolesByEd25519SignerPk(randomKey);
      expect(roles.length).toBe(0);
    });
  });

  describe('findRolesByAuthoritySigner', () => {
    test('finds roles by signer bytes', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByAuthoritySigner(payer.publicKey.toBytes());
      expect(roles.length).toBe(1);
    });
  });

  // ============================================================================
  // findRolesByAuthorityAddress
  // ============================================================================

  describe('findRolesByAuthorityAddress', () => {
    test('finds ed25519 role by authority address', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByAuthorityAddress(payer.publicKey.toBytes());
      expect(roles.length).toBe(1);
    });

    test('finds secp256k1 role by authority address', async () => {
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

      const roles = swig.findRolesByAuthorityAddress(authority.address);
      expect(roles.length).toBe(1);
    });

    test('finds secp256r1 role by authority address', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByAuthorityAddress(
        authority.compressedPublicKey,
      );
      expect(roles.length).toBe(1);
    });

    test('finds programexec role by authority address', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByAuthorityAddress(authority.programId);
      expect(roles.length).toBe(1);
    });

    test('returns empty array for non-matching address', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByAuthorityAddress(randomBytes(32));
      expect(roles.length).toBe(0);
    });

    test('finds correct role among multiple roles', async () => {
      const svm = getSvm();
      const [payer, auth1] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);

      const addAuthIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(auth1.publicKey),
        Actions.set().manageAuthority().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuthIx, payer);

      swig = fetchSwig(svm, swigAddress);

      const roles = swig.findRolesByAuthorityAddress(auth1.publicKey.toBytes());
      expect(roles.length).toBe(1);
      expect(roles[0].id).toBe(1);
    });
  });

  // ============================================================================
  // Static methods
  // ============================================================================

  describe('Swig.fromRawAccountData', () => {
    test('creates Swig from raw account bytes', async () => {
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

      // Get raw account data from SVM using toPublicKey helper
      const { toPublicKey } = await import('../helpers');
      const account = svm.getAccount(toPublicKey(swigAddress));
      if (!account) throw new Error('Account not found');

      const swig = Swig.fromRawAccountData(
        swigAddress,
        Uint8Array.from(account.data),
      );

      expect(swig).toBeInstanceOf(Swig);
      expect(swig.roles.length).toBe(1);
    });
  });

  // ============================================================================
  // setSwigFetchFn
  // ============================================================================

  describe('setSwigFetchFn', () => {
    test('sets custom fetch function', async () => {
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

      const swig = fetchSwig(svm, swigAddress);

      let fetchCalled = false;
      swig.setSwigFetchFn(async () => {
        fetchCalled = true;
        throw new Error('Mock fetch');
      });

      await expect(swig.refetch()).rejects.toThrow('Mock fetch');
      expect(fetchCalled).toBe(true);
    });
  });

  // ============================================================================
  // Multiple roles
  // ============================================================================

  describe('Multiple roles', () => {
    test('handles swig with multiple authorities', async () => {
      const svm = getSvm();
      const [payer, auth1] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);

      // Add second authority
      const addAuthIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(auth1.publicKey),
        Actions.set().manageAuthority().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuthIx, payer);

      // Refetch to get updated roles
      swig = fetchSwig(svm, swigAddress);

      expect(swig.roles.length).toBe(2);
      expect(swig.findRoleById(0)).toBeDefined();
      expect(swig.findRoleById(1)).toBeDefined();
    });
  });
});
