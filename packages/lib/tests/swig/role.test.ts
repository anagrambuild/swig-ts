/**
 * Tests for Role class
 *
 * Tests the Role class methods:
 * - Properties (id, authorityType, authority, actions)
 * - Type guards (isSessionBased, isTokenBased)
 * - Info method
 * - deserializeRoles and deserializeRoleData
 */

import { AuthorityType } from '@swig-wallet/coder';
import {
  Actions,
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSwigInstructionContext,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import { randomBytes, sendSwigSVMTransaction } from '../helpers';

describe('Role class', () => {
  // ============================================================================
  // Properties
  // ============================================================================

  describe('properties', () => {
    test('id returns role ID', async () => {
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
      const role = swig.roles[0];

      expect(role.id).toBe(0);
    });

    test('authorityType returns correct type for Ed25519', async () => {
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
      const role = swig.roles[0];

      expect(role.authorityType).toBe(AuthorityType.Ed25519);
    });

    test('authorityType returns correct type for Ed25519Session', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(payer.publicKey, 100n),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const role = swig.roles[0];

      expect(role.authorityType).toBe(AuthorityType.Ed25519Session);
    });

    test('authority returns Authority instance', async () => {
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
      const role = swig.roles[0];

      expect(role.authority).toBeDefined();
      expect(role.authority.type).toBe(AuthorityType.Ed25519);
    });

    test('actions returns Actions instance', async () => {
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
      const role = swig.roles[0];

      expect(role.actions).toBeDefined();
      expect(role.actions.isRoot()).toBe(true);
    });

    test('swigAddress returns correct address', async () => {
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
      const role = swig.roles[0];

      expect(role.swigAddress.toBase58()).toBe(swig.address.toBase58());
    });

    test('swigId returns correct ID', async () => {
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
      const role = swig.roles[0];

      expect(Array.from(role.swigId)).toEqual(Array.from(swigId));
    });
  });

  // ============================================================================
  // Type guards
  // ============================================================================

  describe('isSessionBased', () => {
    test('returns true for session-based authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(payer.publicKey, 100n),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const role = swig.roles[0];

      expect(role.isSessionBased()).toBe(true);
    });

    test('returns false for non-session authority', async () => {
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
      const role = swig.roles[0];

      expect(role.isSessionBased()).toBe(false);
    });
  });

  describe('isTokenBased', () => {
    // Note: Ed25519Authority extends TokenBasedAuthority in the library
    // so isTokenBased returns true for Ed25519 authorities
    test('returns true for Ed25519 authority (extends TokenBasedAuthority)', async () => {
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
      const role = swig.roles[0];

      // Ed25519Authority extends TokenBasedAuthority
      expect(role.isTokenBased()).toBe(true);
    });
  });

  // ============================================================================
  // info method
  // ============================================================================

  describe('info', () => {
    test('returns RoleInfo object', async () => {
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
      const role = swig.roles[0];

      const info = role.info();
      expect(info.id).toBe(0);
      expect(info.authorityType).toBe(AuthorityType.Ed25519);
    });
  });

  // ============================================================================
  // Actions queries
  // ============================================================================

  describe('Actions through Role', () => {
    test('role.actions.canManageAuthority returns true for root', async () => {
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
      const role = swig.roles[0];

      expect(role.actions.canManageAuthority()).toBe(true);
    });

    test('role.actions reflects the granted permissions', async () => {
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

      // Add limited authority
      const addAuthIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(auth1.publicKey),
        Actions.set().solLimit({ amount: 1_000_000_000n }).get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuthIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const limitedRole = swig.findRoleById(1)!;

      expect(limitedRole.actions.canManageAuthority()).toBe(false);
      expect(limitedRole.actions.canSpendSol()).toBe(true);
      expect(limitedRole.actions.isRoot()).toBe(false);
    });
  });

  // ============================================================================
  // Multiple roles scenarios
  // ============================================================================

  describe('Multiple roles', () => {
    test('each role has unique ID', async () => {
      const svm = getSvm();
      const [payer, auth1, auth2] = getFundedKeys(svm, 3);
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

      // Add two more authorities
      const addAuth1Ix = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(auth1.publicKey),
        Actions.set().manageAuthority().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuth1Ix, payer);

      swig = fetchSwig(svm, swigAddress);

      const addAuth2Ix = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(auth2.publicKey),
        Actions.set().programAll().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuth2Ix, payer);

      swig = fetchSwig(svm, swigAddress);

      expect(swig.roles.length).toBe(3);
      const ids = swig.roles.map((r) => r.id);
      expect(ids).toEqual([0, 1, 2]);
    });

    test('roles maintain their individual actions', async () => {
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

      const rootRole = swig.findRoleById(0)!;
      const limitedRole = swig.findRoleById(1)!;

      // Root has All permission
      expect(rootRole.actions.isRoot()).toBe(true);

      // Limited role only has ManageAuthority (+ ProgramAll added automatically)
      expect(limitedRole.actions.isRoot()).toBe(false);
      expect(limitedRole.actions.canManageAuthority()).toBe(true);
    });
  });
});
