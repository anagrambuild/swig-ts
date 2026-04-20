/**
 * Tests for Ed25519 Authority classes
 */

import { AuthorityType } from '@swig-wallet/coder';
import {
  Actions,
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  findSwigPdaRaw,
  findSwigSubAccountPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSessionInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  isEd25519Authority,
  isEd25519SessionAuthority,
  SolPublicKey,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  generateTestKeypair,
  randomBytes,
  sendSwigSVMTransaction,
  toPublicKey,
} from '../helpers';

describe('Ed25519 Authority', () => {
  // ============================================================================
  // Ed25519 Authority
  // ============================================================================

  describe('Ed25519Authority', () => {
    test('type is Ed25519', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.type).toBe(AuthorityType.Ed25519);
    });

    test('session is false', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.session).toBe(false);
    });

    test('matchesSigner returns true for correct signer', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.matchesSigner(payer.publicKey.toBytes())).toBe(true);
    });

    test('matchesSigner returns false for wrong signer', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const wrongSigner = generateTestKeypair();
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
      const authority = swig.roles[0].authority;

      expect(authority.matchesSigner(wrongSigner.publicKey.toBytes())).toBe(
        false,
      );
    });

    test('isEqual returns true for same authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with payer as root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);

      // Add another authority with same public key to compare
      const addAuthIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(payer.publicKey), // Same pubkey
        Actions.set().manageAuthority().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuthIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const authority1 = swig.roles[0].authority;
      const authority2 = swig.roles[1].authority;

      expect(authority1.isEqual(authority2)).toBe(true);
    });

    test('isEqual returns false for different authority', async () => {
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

      // Add different authority
      const addAuthIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(auth1.publicKey), // Different pubkey
        Actions.set().manageAuthority().get(),
        { payer: payer.publicKey },
      );
      sendSwigSVMTransaction(svm, addAuthIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const authority1 = swig.roles[0].authority;
      const authority2 = swig.roles[1].authority;

      expect(authority1.isEqual(authority2)).toBe(false);
    });

    test('signer property returns correct bytes', async () => {
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
      const authority = swig.roles[0].authority;

      expect(Array.from(authority.signer)).toEqual(
        Array.from(payer.publicKey.toBytes()),
      );
    });

    test('id property returns correct bytes', async () => {
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
      const authority = swig.roles[0].authority;

      expect(Array.from(authority.id)).toEqual(
        Array.from(payer.publicKey.toBytes()),
      );
    });

    test('address returns public key bytes', async () => {
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
      const authority = swig.roles[0].authority;

      expect(Array.from(authority.address)).toEqual(
        Array.from(payer.publicKey.toBytes()),
      );
    });

    test('addressString returns base58', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.addressString).toBe(payer.publicKey.toBase58());
    });

    test('signerAddress returns same as address for token authority', async () => {
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
      const authority = swig.roles[0].authority;

      expect(Array.from(authority.signerAddress)).toEqual(
        Array.from(authority.address),
      );
      expect(authority.signerAddressString).toBe(authority.addressString);
    });

    test('matchesAddress returns true for correct address', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.matchesAddress(payer.publicKey.toBytes())).toBe(true);
    });

    test('matchesAddress returns false for wrong address', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const wrongSigner = generateTestKeypair();
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
      const authority = swig.roles[0].authority;

      expect(authority.matchesAddress(wrongSigner.publicKey.toBytes())).toBe(
        false,
      );
    });

    test('ed25519PublicKey returns SolPublicKey', async () => {
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

      if (isEd25519Authority(authority)) {
        expect(authority.ed25519PublicKey).toBeInstanceOf(SolPublicKey);
        expect(authority.ed25519PublicKey.toBase58()).toBe(payer.address);
      } else {
        throw new Error('Expected Ed25519Authority');
      }
    });
  });

  // ============================================================================
  // Ed25519 Session Authority
  // ============================================================================

  describe('Ed25519SessionAuthority', () => {
    test('type is Ed25519Session', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.type).toBe(AuthorityType.Ed25519Session);
    });

    test('session is true', async () => {
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
      const authority = swig.roles[0].authority;

      expect(authority.session).toBe(true);
    });

    test('has sessionKey after creating session', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
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

      // Create a session
      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        100n,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const role = updatedSwig.findRoleBySessionKey(sessionKey.address);

      expect(role).toBeDefined();
      expect(role!.isSessionBased()).toBe(true);
    });

    test('ed25519PublicKey returns SolPublicKey', async () => {
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

      if (isEd25519SessionAuthority(authority)) {
        expect(authority.ed25519PublicKey).toBeInstanceOf(SolPublicKey);
        expect(authority.ed25519PublicKey.toBase58()).toBe(payer.address);
      } else {
        throw new Error('Expected Ed25519SessionAuthority');
      }
    });

    test('publicKey is alias for ed25519PublicKey', async () => {
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

      if (isEd25519SessionAuthority(authority)) {
        expect(authority.publicKey.toBase58()).toBe(
          authority.ed25519PublicKey.toBase58(),
        );
      } else {
        throw new Error('Expected Ed25519SessionAuthority');
      }
    });

    test('address returns underlying public key bytes', async () => {
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

      if (isEd25519SessionAuthority(authority)) {
        expect(Array.from(authority.address)).toEqual(
          Array.from(authority.ed25519PublicKey.toBytes()),
        );
      } else {
        throw new Error('Expected Ed25519SessionAuthority');
      }
    });

    test('addressString returns base58 of underlying public key', async () => {
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

      expect(authority.addressString).toBe(payer.address);
    });

    test('signerAddress returns session key bytes after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
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

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const authority = updatedSwig.roles[0].authority;

      expect(Array.from(authority.signerAddress)).toEqual(
        Array.from(sessionKey.publicKey.toBytes()),
      );
      expect(authority.signerAddressString).toBe(sessionKey.address);
    });

    test('matchesAddress returns true for underlying public key', async () => {
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

      expect(authority.matchesAddress(payer.publicKey.toBytes())).toBe(true);
    });

    test('sessionKey returns SolPublicKey after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
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

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const authority = updatedSwig.roles[0].authority;

      if (isEd25519SessionAuthority(authority)) {
        expect(authority.sessionKey).toBeInstanceOf(SolPublicKey);
        expect(authority.sessionKey.toBase58()).toBe(sessionKey.address);
      } else {
        throw new Error('Expected Ed25519SessionAuthority');
      }
    });

    test('expirySlot returns correct value after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);
      const sessionDuration = 50n;

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
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
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const authority = updatedSwig.roles[0].authority;

      if (isEd25519SessionAuthority(authority)) {
        // Expiry slot should be currentSlot + sessionDuration
        expect(authority.expirySlot).toBeGreaterThanOrEqual(
          currentSlot + sessionDuration,
        );
      } else {
        throw new Error('Expected Ed25519SessionAuthority');
      }
    });

    test('maxDuration returns configured max duration', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const maxSessionDuration = 500n;

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(
          payer.address,
          maxSessionDuration,
        ),
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const authority = swig.roles[0].authority;

      if (isEd25519SessionAuthority(authority)) {
        expect(authority.maxDuration).toBe(maxSessionDuration);
      } else {
        throw new Error('Expected Ed25519SessionAuthority');
      }
    });

    test('matchesSigner returns true for session key after session created', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
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

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      const updatedSwig = fetchSwig(svm, swigAddress);
      const authority = updatedSwig.roles[0].authority;

      expect(authority.matchesSigner(sessionKey.publicKey.toBytes())).toBe(
        true,
      );
    });

    test('session authority can create sub-account after session activation', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().subAccount().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      swig = fetchSwig(svm, swigAddress);

      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        0,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer, [sessionKey]);

      const [subAccountAddress] = await findSwigSubAccountPdaRaw(swigId, 0);
      const balance = svm.getBalance(toPublicKey(subAccountAddress));
      expect(balance).toBeGreaterThan(0n);
    });

    test('session authority builds addAuthority instruction without byte-length error', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const sessionKey = generateTestKeypair();
      const newAuthority = generateTestKeypair();
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(payer.address, 100n),
        id: swigId,
        payer: payer.address,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);

      const createSessionIx = await getCreateSessionInstructionContext(
        swig,
        0,
        sessionKey.address,
        50n,
        { payer: payer.address },
      );
      sendSwigSVMTransaction(svm, createSessionIx, payer);

      swig = fetchSwig(svm, swigAddress);

      // Before the fix, this threw "Invalid PublicKey byte length. Length is 80, not 32 bytes"
      // because addAuthority passed the full 80-byte authority struct instead of the 32-byte session key
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        0,
        createEd25519AuthorityInfo(newAuthority.address),
        Actions.set().solLimit({ amount: 500_000_000n }).get(),
      );

      const instructions = addIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThan(0);
    });
  });
});
