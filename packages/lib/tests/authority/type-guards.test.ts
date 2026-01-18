/**
 * Tests for Authority type guards and cross-type comparisons
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSwigInstructionContext,
  isEd25519Authority,
  isEd25519BasedAuthority,
  isEd25519SessionAuthority,
  isSecp256k1BasedAuthority,
  isSessionBasedAuthority,
  isTokenBasedAuthority,
} from '../../src';
import { isSecp256r1BasedAuthority } from '../../src/authority/secp256r1/based';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256k1SessionAuthority,
  createTestSecp256r1Authority,
  createTestSecp256r1SessionAuthority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction } from '../helpers';

describe('Authority Type Guards', () => {
  // ============================================================================
  // Cross-type comparisons
  // ============================================================================

  describe('Cross-type comparisons', () => {
    test('isEqual returns false for different authority types', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secp256r1Authority = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);

      // Add Secp256r1 authority
      const addAuthIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        secp256r1Authority.authorityInfo,
        Actions.set().manageAuthority().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuthIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const ed25519Auth = swig.roles[0].authority;
      const secp256r1Auth = swig.roles[1].authority;

      expect(ed25519Auth.isEqual(secp256r1Auth)).toBe(false);
    });
  });

  // ============================================================================
  // Type Guards
  // ============================================================================

  describe('Type Guards', () => {
    describe('isTokenBasedAuthority', () => {
      test('returns true for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isTokenBasedAuthority(authority)).toBe(true);
      });

      test('returns true for Secp256k1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1Auth = createTestSecp256k1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isTokenBasedAuthority(authority)).toBe(true);
      });

      test('returns true for Secp256r1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1Auth = createTestSecp256r1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isTokenBasedAuthority(authority)).toBe(true);
      });

      test('returns false for Ed25519SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isTokenBasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256k1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1SessionAuth = createTestSecp256k1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isTokenBasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256r1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1SessionAuth = createTestSecp256r1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isTokenBasedAuthority(authority)).toBe(false);
      });
    });

    describe('isSessionBasedAuthority', () => {
      test('returns false for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSessionBasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256k1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1Auth = createTestSecp256k1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSessionBasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256r1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1Auth = createTestSecp256r1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSessionBasedAuthority(authority)).toBe(false);
      });

      test('returns true for Ed25519SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSessionBasedAuthority(authority)).toBe(true);
      });

      test('returns true for Secp256k1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1SessionAuth = createTestSecp256k1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSessionBasedAuthority(authority)).toBe(true);
      });

      test('returns true for Secp256r1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1SessionAuth = createTestSecp256r1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSessionBasedAuthority(authority)).toBe(true);
      });
    });

    describe('isEd25519Authority', () => {
      test('returns true for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519Authority(authority)).toBe(true);
      });

      test('returns false for Ed25519SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519Authority(authority)).toBe(false);
      });

      test('returns false for Secp256k1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1Auth = createTestSecp256k1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519Authority(authority)).toBe(false);
      });
    });

    describe('isEd25519SessionAuthority', () => {
      test('returns true for Ed25519SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519SessionAuthority(authority)).toBe(true);
      });

      test('returns false for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519SessionAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256k1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1SessionAuth = createTestSecp256k1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519SessionAuthority(authority)).toBe(false);
      });
    });

    describe('isEd25519BasedAuthority', () => {
      test('returns true for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519BasedAuthority(authority)).toBe(true);
      });

      test('returns true for Ed25519SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519BasedAuthority(authority)).toBe(true);
      });

      test('returns false for Secp256k1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1Auth = createTestSecp256k1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519BasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256r1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1Auth = createTestSecp256r1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isEd25519BasedAuthority(authority)).toBe(false);
      });
    });

    describe('isSecp256k1BasedAuthority', () => {
      test('returns true for Secp256k1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1Auth = createTestSecp256k1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256k1BasedAuthority(authority)).toBe(true);
      });

      test('returns true for Secp256k1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1SessionAuth = createTestSecp256k1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256k1BasedAuthority(authority)).toBe(true);
      });

      test('returns false for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256k1BasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256r1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1Auth = createTestSecp256r1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256k1BasedAuthority(authority)).toBe(false);
      });
    });

    describe('isSecp256r1BasedAuthority', () => {
      test('returns true for Secp256r1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1Auth = createTestSecp256r1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256r1BasedAuthority(authority)).toBe(true);
      });

      test('returns true for Secp256r1SessionAuthority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256r1SessionAuth = createTestSecp256r1SessionAuthority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256r1SessionAuth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256r1BasedAuthority(authority)).toBe(true);
      });

      test('returns false for Ed25519Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: createEd25519AuthorityInfo(payer.address),
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256r1BasedAuthority(authority)).toBe(false);
      });

      test('returns false for Secp256k1Authority', async () => {
        const svm = getSvm();
        const [payer] = getFundedKeys(svm, 1);
        const swigId = randomBytes(32);
        const secp256k1Auth = createTestSecp256k1Authority();

        const [swigAddress] = await findSwigPdaRaw(swigId);

        const createIx = await getCreateSwigInstructionContext({
          authorityInfo: secp256k1Auth.authorityInfo,
          id: swigId,
          payer: payer.address,
          actions: Actions.set().all().get(),
        });
        sendSwigSVMTransaction(svm, createIx, payer);

        const swig = fetchSwig(svm, swigAddress);
        const authority = swig.roles[0].authority;

        expect(isSecp256r1BasedAuthority(authority)).toBe(false);
      });
    });
  });
});
