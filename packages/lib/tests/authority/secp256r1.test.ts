/**
 * Tests for Secp256r1Authority and Secp256r1SessionAuthority
 */

import { AuthorityType } from '@swig-wallet/coder';
import {
  Actions,
  findSwigPdaRaw,
  getCreateSessionInstructionContext,
  getCreateSwigInstructionContext,
  isSessionBasedAuthority,
  isTokenBasedAuthority,
  SolPublicKey,
} from '../../src';
import { isSecp256r1BasedAuthority } from '../../src/authority/secp256r1/based';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256r1Authority,
  createTestSecp256r1SessionAuthority,
} from '../fixtures/authorities';
import {
  generateTestKeypair,
  randomBytes,
  sendSwigSVMTransaction,
} from '../helpers';

describe('Secp256r1 Authority', () => {
  // ============================================================================
  // Secp256r1 Authority
  // ============================================================================

  describe('Secp256r1Authority', () => {
    test('type is Secp256r1', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1Authority();

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

      expect(swigAuthority.type).toBe(AuthorityType.Secp256r1);
    });

    test('session is false', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1Authority();

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

    test('signer property is defined', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1Authority();

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

      expect(swigAuthority.signer).toBeDefined();
      expect(swigAuthority.signer.length).toBeGreaterThan(0);
    });

    test('secp256r1PublicKey returns 33-byte compressed key', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isSecp256r1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256r1PublicKey).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.secp256r1PublicKey.length).toBe(33);
      } else {
        throw new Error('Expected Secp256r1Authority');
      }
    });

    test('publicKeyBytes returns raw bytes', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if ('publicKeyBytes' in swigAuthority) {
        expect((swigAuthority as any).publicKeyBytes).toBeInstanceOf(
          Uint8Array,
        );
        expect((swigAuthority as any).publicKeyBytes.length).toBe(33);
      } else {
        throw new Error('Expected Secp256r1Authority with publicKeyBytes');
      }
    });

    test('publicKeyString returns hex', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if ('publicKeyString' in swigAuthority) {
        expect(typeof (swigAuthority as any).publicKeyString).toBe('string');
        expect((swigAuthority as any).publicKeyString).toMatch(/^[0-9a-f]+$/i);
      } else {
        throw new Error('Expected Secp256r1Authority with publicKeyString');
      }
    });

    test('odometer returns incremented value', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isTokenBasedAuthority(swigAuthority) && 'odometer' in swigAuthority) {
        const odometerValue = (swigAuthority as any).odometer();
        expect(typeof odometerValue).toBe('number');
        expect(odometerValue).toBeGreaterThan(0);
      } else {
        throw new Error('Expected Secp256r1Authority with odometer');
      }
    });

    test('matchesSigner returns true for compressed public key', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.matchesSigner(authority.compressedPublicKey)).toBe(
        true,
      );
    });
  });

  // ============================================================================
  // Secp256r1 Session Authority
  // ============================================================================

  describe('Secp256r1SessionAuthority', () => {
    test('type is Secp256r1Session', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.type).toBe(AuthorityType.Secp256r1Session);
    });

    test('session is true', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.session).toBe(true);
    });

    test('secp256r1PublicKey returns 33-byte compressed key', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      if (isSecp256r1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256r1PublicKey).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.secp256r1PublicKey.length).toBe(33);
      } else {
        throw new Error('Expected Secp256r1SessionAuthority');
      }
    });

    test('maxDuration returns configured max duration', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const maxSessionDuration = 500n;
      const authority = createTestSecp256r1SessionAuthority(maxSessionDuration);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      if (isSessionBasedAuthority(swigAuthority)) {
        expect(swigAuthority.maxDuration).toBe(maxSessionDuration);
      } else {
        throw new Error('Expected Secp256r1SessionAuthority');
      }
    });

    test('odometer returns incremented value', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const swigAuthority = swig.roles[0].authority;

      if ('odometer' in swigAuthority) {
        const odometerValue = (swigAuthority as any).odometer();
        expect(typeof odometerValue).toBe('number');
        expect(odometerValue).toBeGreaterThan(0);
      } else {
        throw new Error('Expected Secp256r1SessionAuthority with odometer');
      }
    });

    test('sessionKey returns SolPublicKey after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        {
          payer: payer.address,
          signingFn: authority.signingFn!,
          currentSlot: BigInt(svm.getClock().slot),
        },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const swigAuthority = updatedSwig.roles[0].authority;

      if (isSessionBasedAuthority(swigAuthority)) {
        expect(swigAuthority.sessionKey).toBeInstanceOf(SolPublicKey);
        expect(swigAuthority.sessionKey.toBase58()).toBe(sessionKey.address);
      } else {
        throw new Error('Expected Secp256r1SessionAuthority');
      }
    });

    test('expirySlot returns correct value after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const sessionDuration = 50n;
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const currentSlot = BigInt(svm.getClock().slot);

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        sessionDuration,
        { payer: payer.address, signingFn: authority.signingFn!, currentSlot },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const swigAuthority = updatedSwig.roles[0].authority;

      if (isSessionBasedAuthority(swigAuthority)) {
        expect(swigAuthority.expirySlot).toBeGreaterThanOrEqual(
          currentSlot + sessionDuration,
        );
      } else {
        throw new Error('Expected Secp256r1SessionAuthority');
      }
    });

    test('matchesSigner returns true for session key after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const authority = createTestSecp256r1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        {
          payer: payer.address,
          signingFn: authority.signingFn!,
          currentSlot: BigInt(svm.getClock().slot),
        },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const swigAuthority = updatedSwig.roles[0].authority;

      expect(swigAuthority.matchesSigner(sessionKey.publicKey.toBytes())).toBe(
        true,
      );
    });
  });
});
