/**
 * Tests for ProgramExecAuthority and ProgramExecSessionAuthority
 */

import { AuthorityType } from '@swig-wallet/coder';
import {
  Actions,
  findSwigPdaRaw,
  getCreateSwigInstructionContext,
  isProgramExecAuthority,
  isProgramExecBasedAuthority,
  isProgramExecSessionAuthority,
  isSessionBasedAuthority,
  isTokenBasedAuthority,
  SolPublicKey,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestProgramExecAuthority,
  createTestProgramExecSessionAuthority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction } from '../helpers';

describe('ProgramExec Authority', () => {
  // ============================================================================
  // ProgramExecAuthority
  // ============================================================================

  describe('ProgramExecAuthority', () => {
    test('type is ProgramExec', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.type).toBe(AuthorityType.ProgramExec);
    });

    test('session is false', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.session).toBe(false);
    });

    test('programId returns correct value', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isProgramExecBasedAuthority(swigAuthority)) {
        expect(swigAuthority.programId).toBeInstanceOf(SolPublicKey);
        expect(swigAuthority.programId.toBytes().length).toBe(32);
      } else {
        throw new Error('Expected ProgramExecAuthority');
      }
    });

    test('instructionPrefix returns correct value', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isProgramExecBasedAuthority(swigAuthority)) {
        expect(swigAuthority.instructionPrefix).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.instructionPrefixLen).toBeGreaterThan(0);
        expect(swigAuthority.instructionPrefixLen).toBeLessThanOrEqual(40);
      } else {
        throw new Error('Expected ProgramExecAuthority');
      }
    });

    test('passes isTokenBasedAuthority check', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(isTokenBasedAuthority(swigAuthority)).toBe(true);
    });

    test('passes isProgramExecAuthority check', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(isProgramExecAuthority(swigAuthority)).toBe(true);
    });

    test('passes isProgramExecBasedAuthority check', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(isProgramExecBasedAuthority(swigAuthority)).toBe(true);
    });

    test('address returns program ID bytes', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.address).toBeInstanceOf(Uint8Array);
      expect(swigAuthority.address.length).toBe(32);
      expect(Array.from(swigAuthority.address)).toEqual(
        Array.from(authority.programId),
      );
    });

    test('addressString returns base58', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isProgramExecBasedAuthority(swigAuthority)) {
        expect(swigAuthority.addressString).toBe(
          swigAuthority.programId.toBase58(),
        );
      } else {
        throw new Error('Expected ProgramExecAuthority');
      }
    });

    test('signerAddress returns same as address for token authority', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(Array.from(swigAuthority.signerAddress)).toEqual(
        Array.from(swigAuthority.address),
      );
      expect(swigAuthority.signerAddressString).toBe(
        swigAuthority.addressString,
      );
    });

    test('matchesAddress returns true for program ID', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.matchesAddress(authority.programId)).toBe(true);
    });
  });

  // ============================================================================
  // ProgramExecSessionAuthority
  // ============================================================================

  describe('ProgramExecSessionAuthority', () => {
    test('type is ProgramExecSession', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.type).toBe(AuthorityType.ProgramExecSession);
    });

    test('session is true', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.session).toBe(true);
    });

    test('passes isSessionBasedAuthority check', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(isSessionBasedAuthority(swigAuthority)).toBe(true);
    });

    test('passes isProgramExecSessionAuthority check', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(isProgramExecSessionAuthority(swigAuthority)).toBe(true);
    });

    test('passes isProgramExecBasedAuthority check', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(isProgramExecBasedAuthority(swigAuthority)).toBe(true);
    });

    test('address returns program ID bytes', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.address).toBeInstanceOf(Uint8Array);
      expect(swigAuthority.address.length).toBe(32);
      expect(Array.from(swigAuthority.address)).toEqual(
        Array.from(authority.programId),
      );
    });

    test('addressString returns base58', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      if (isProgramExecBasedAuthority(swigAuthority)) {
        expect(swigAuthority.addressString).toBe(
          swigAuthority.programId.toBase58(),
        );
      } else {
        throw new Error('Expected ProgramExecSessionAuthority');
      }
    });

    test('matchesAddress returns true for program ID', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.matchesAddress(authority.programId)).toBe(true);
    });

    test('maxDuration returns configured max duration', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const maxSessionDuration = 5000n;
      const authority =
        createTestProgramExecSessionAuthority(maxSessionDuration);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      if (isSessionBasedAuthority(swigAuthority)) {
        expect(swigAuthority.maxDuration).toBe(maxSessionDuration);
      } else {
        throw new Error('Expected SessionBasedAuthority');
      }
    });

    test('expirySlot is initially 0', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestProgramExecSessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      if (isSessionBasedAuthority(swigAuthority)) {
        expect(swigAuthority.expirySlot).toBe(0n);
      } else {
        throw new Error('Expected SessionBasedAuthority');
      }
    });
  });
});
