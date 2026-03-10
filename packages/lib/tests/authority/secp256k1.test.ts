/**
 * Tests for Secp256k1Authority and Secp256k1SessionAuthority
 */

import { AuthorityType } from '@swig-wallet/coder';
import {
  Actions,
  createSecp256k1AuthorityInfo,
  findSwigPdaRaw,
  getCreateSessionInstructionContext,
  getCreateSwigInstructionContext,
  isSecp256k1BasedAuthority,
  isSessionBasedAuthority,
  isTokenBasedAuthority,
  SolPublicKey,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256k1SessionAuthority,
} from '../fixtures/authorities';
import {
  generateTestKeypair,
  randomBytes,
  sendSwigSVMTransaction,
} from '../helpers';

describe('Secp256k1 Authority', () => {
  // ============================================================================
  // Secp256k1 Authority
  // ============================================================================

  describe('Secp256k1Authority', () => {
    test('createSecp256k1AuthorityInfo accepts hex public keys', () => {
      const authority = createTestSecp256k1Authority();
      const publicKeyHex = Buffer.from(authority.publicKey).toString('hex');

      const info = createSecp256k1AuthorityInfo(publicKeyHex);

      expect(info.type).toBe(AuthorityType.Secp256k1);
      expect(info.data).toEqual(authority.publicKey);
    });

    test('createSecp256k1AuthorityInfo rejects Base58 input', () => {
      const base58PublicKey = generateTestKeypair().publicKey.toBase58();

      expect(() => createSecp256k1AuthorityInfo(base58PublicKey)).toThrow(
        'Invalid secp256k1 public key format',
      );
    });

    test('type is Secp256k1', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1Authority();

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

      expect(swigAuthority.type).toBe(AuthorityType.Secp256k1);
    });

    test('session is false', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1Authority();

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

    test('can be found by ethereum address', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const roles = swig.findRolesBySecp256k1SignerAddress(authority.address);

      expect(roles.length).toBe(1);
      expect(roles[0].authority.type).toBe(AuthorityType.Secp256k1);
    });

    test('secp256k1Address returns 20-byte address', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256k1Address).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.secp256k1Address.length).toBe(20);
      } else {
        throw new Error('Expected Secp256k1Authority');
      }
    });

    test('secp256k1AddressString returns 0x-prefixed hex', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256k1AddressString).toMatch(/^Ox[0-9a-f]+$/i);
      } else {
        throw new Error('Expected Secp256k1Authority');
      }
    });

    test('secp256k1PublicKey returns 33-byte compressed key', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256k1PublicKey).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.secp256k1PublicKey.length).toBe(33);
      } else {
        throw new Error('Expected Secp256k1Authority');
      }
    });

    test('secp256k1PublicKeyString returns hex string', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(typeof swigAuthority.secp256k1PublicKeyString).toBe('string');
        expect(swigAuthority.secp256k1PublicKeyString).toMatch(/^[0-9a-f]+$/i);
      } else {
        throw new Error('Expected Secp256k1Authority');
      }
    });

    test('odometer returns incremented value', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      if (isTokenBasedAuthority(swigAuthority) && 'odometer' in swigAuthority) {
        const odometerValue = (swigAuthority as any).odometer();
        expect(typeof odometerValue).toBe('number');
        expect(odometerValue).toBeGreaterThan(0);
      } else {
        throw new Error('Expected Secp256k1Authority with odometer');
      }
    });

    test('matchesSigner returns true for ethereum address bytes', async () => {
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
      const swigAuthority = swig.roles[0].authority;

      expect(swigAuthority.matchesSigner(authority.address)).toBe(true);
    });
  });

  // ============================================================================
  // Secp256k1 Session Authority
  // ============================================================================

  describe('Secp256k1SessionAuthority', () => {
    test('type is Secp256k1Session', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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

      expect(swigAuthority.type).toBe(AuthorityType.Secp256k1Session);
    });

    test('session is true', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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

    test('secp256k1Address returns 20-byte address', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256k1Address).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.secp256k1Address.length).toBe(20);
      } else {
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('secp256k1AddressString returns 0x-prefixed hex', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256k1AddressString).toMatch(/^Ox[0-9a-f]+$/i);
      } else {
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('secp256k1PublicKey returns 33-byte compressed key', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(swigAuthority.secp256k1PublicKey).toBeInstanceOf(Uint8Array);
        expect(swigAuthority.secp256k1PublicKey.length).toBe(33);
      } else {
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('secp256k1PublicKeyString returns hex string', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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

      if (isSecp256k1BasedAuthority(swigAuthority)) {
        expect(typeof swigAuthority.secp256k1PublicKeyString).toBe('string');
        expect(swigAuthority.secp256k1PublicKeyString).toMatch(/^[0-9a-f]+$/i);
      } else {
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('maxDuration returns configured max duration', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const maxSessionDuration = 500n;
      const authority = createTestSecp256k1SessionAuthority(maxSessionDuration);

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
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('odometer returns incremented value', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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
        throw new Error('Expected Secp256k1SessionAuthority with odometer');
      }
    });

    test('sessionKey returns SolPublicKey after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('expirySlot returns correct value after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const sessionDuration = 50n;
      const authority = createTestSecp256k1SessionAuthority();

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
        throw new Error('Expected Secp256k1SessionAuthority');
      }
    });

    test('matchesSigner returns true for session key after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const authority = createTestSecp256k1SessionAuthority();

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
