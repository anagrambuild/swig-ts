/**
 * Tests for CreateV1 instruction - Swig account creation
 *
 * Tests creating Swig accounts with:
 * - Ed25519 authority
 * - Secp256k1 authority
 * - Secp256r1 authority
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  getCreateSwigInstructionContext,
  getSwigWalletAddressRaw,
  SolPublicKey,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction, toPublicKey } from '../helpers';

const SOL = 1_000_000_000n; // lamports per SOL

describe('CreateV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Authority Tests
  // ============================================================================

  describe('with Ed25519 authority', () => {
    test('creates swig account with root permissions', async () => {
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
      expect(swig).toBeDefined();
      expect(swig.roles.length).toBe(1);
      expect(swig.roles[0].actions.isRoot()).toBe(true);
    });

    test('creates swig account with manageAuthority permission only', async () => {
      // Note: Root authority MUST have ManageAuthority or All permission per protocol
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().manageAuthority().get(),
      });

      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      expect(swig).toBeDefined();
      expect(swig.roles.length).toBe(1);
      expect(swig.roles[0].actions.isRoot()).toBe(false);
      expect(swig.roles[0].actions.canManageAuthority()).toBe(true);
    });

    test('derives wallet address correctly', async () => {
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
      const walletAddress = await getSwigWalletAddressRaw(swig);

      expect(walletAddress).toBeDefined();
      expect(walletAddress).toBeInstanceOf(SolPublicKey);

      // Fund wallet and verify it can receive additional funds
      const walletPubkey = toPublicKey(walletAddress);
      const initialBalance = svm.getBalance(walletPubkey) ?? 0n;
      svm.airdrop(walletPubkey, SOL);
      expect(svm.getBalance(walletPubkey)).toBe(initialBalance + SOL);
    });

    test('finds role by Ed25519 signer public key', async () => {
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
      expect(roles[0].authority.matchesSigner(payer.publicKey.toBytes())).toBe(
        true,
      );
    });

    test('instruction has correct account metas', async () => {
      const [payer] = getFundedKeys(getSvm(), 1);
      const swigId = randomBytes(32);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });

      const instructions = createIx.getKitInstructions();
      expect(instructions.length).toBe(1);

      const ix = instructions[0];
      // CreateV1 should have: swig (writable), payer (writable signer),
      // swigSystemAddress (writable), system program (readonly)
      expect(ix.accounts.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================

  describe('with Secp256k1 authority', () => {
    test('creates swig account with root permissions', async () => {
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
      expect(swig).toBeDefined();
      expect(swig.roles.length).toBe(1);
      expect(swig.roles[0].actions.isRoot()).toBe(true);
    });

    test('finds role by Secp256k1 signer address', async () => {
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
      expect(roles[0].id).toBe(0);
    });

    test('derives wallet address correctly', async () => {
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
      const walletAddress = await getSwigWalletAddressRaw(swig);

      expect(walletAddress).toBeDefined();
      expect(walletAddress).toBeInstanceOf(SolPublicKey);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================

  describe('with Secp256r1 authority', () => {
    test('creates swig account with root permissions', async () => {
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
      expect(swig).toBeDefined();
      expect(swig.roles.length).toBe(1);
      expect(swig.roles[0].actions.isRoot()).toBe(true);
    });

    test('derives wallet address correctly', async () => {
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
      const walletAddress = await getSwigWalletAddressRaw(swig);

      expect(walletAddress).toBeDefined();
      expect(walletAddress).toBeInstanceOf(SolPublicKey);
    });
  });

  // ============================================================================
  // Actions variations (using Ed25519 for simplicity)
  // ============================================================================

  describe('Actions variations', () => {
    test('creates with manageAuthority permission', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().manageAuthority().get(),
      });

      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      expect(swig.roles[0].actions.canManageAuthority()).toBe(true);
      expect(swig.roles[0].actions.isRoot()).toBe(false);
    });
  });
});
