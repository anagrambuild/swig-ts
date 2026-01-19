/**
 * Tests for SubAccountToggleV1 instruction - Toggling sub-account status
 *
 * Sub-accounts can be enabled or disabled:
 * - The sub-account owner can toggle their own sub-account
 * - A root authority (All or ManageAuthority) can toggle any sub-account
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  findSwigSubAccountPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getToggleSubAccountInstructionContext,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction, toPublicKey } from '../helpers';

const SOL = 1_000_000_000n;

describe('SubAccountToggleV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Authority Tests
  // ============================================================================

  describe('Ed25519 authority with sub-account', () => {
    test('can disable own sub-account', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(subAccountAuth.publicKey),
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];

      // Create sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      // Verify sub-account was created
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      const subAccountBalance = svm.getBalance(toPublicKey(subAccountAddress));
      expect(subAccountBalance).toBeGreaterThan(0n);

      // Disable sub-account
      swig = fetchSwig(svm, swigAddress);
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        false, // enabled = false
      );
      sendSwigSVMTransaction(svm, toggleIx, subAccountAuth);

      // Verify sub-account is disabled by checking the role's actions
      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];
      // The sub-account action should have enabled = false
      // Note: We can't directly read the enabled state from the role,
      // but we can verify the transaction succeeded
      expect(updatedRole).toBeDefined();
    });

    test('can re-enable own sub-account', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(subAccountAuth.publicKey),
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];

      // Create sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      // Disable sub-account
      swig = fetchSwig(svm, swigAddress);
      const disableIx = await getToggleSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        false,
      );
      sendSwigSVMTransaction(svm, disableIx, subAccountAuth);

      // Re-enable sub-account
      swig = fetchSwig(svm, swigAddress);
      const enableIx = await getToggleSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        true,
      );
      sendSwigSVMTransaction(svm, enableIx, subAccountAuth);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];
      expect(updatedRole).toBeDefined();
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================

  describe('Secp256k1 authority with sub-account', () => {
    test('can disable own sub-account', async () => {
      const svm = getSvm();
      const [payer, root] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add secp256k1 authority with subAccount permission
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpAuthority.authorityInfo,
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesBySecp256k1SignerAddress(
        secpAuthority.address,
      )[0];
      let slot = svm.getClock().slot;

      // Create sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Disable sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        false,
        undefined,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );

      sendSwigSVMTransaction(svm, toggleIx, payer);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================

  describe('Secp256r1 authority with sub-account', () => {
    test('can disable own sub-account', async () => {
      const svm = getSvm();
      const [payer, root] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add secp256r1 authority with subAccount permission
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpAuthority.authorityInfo,
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.roles[1]; // Secp256r1 role is at index 1
      let slot = svm.getClock().slot;

      // Create sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Disable sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        false,
        undefined,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, toggleIx, payer);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });
  });

  // ============================================================================
  // Root Authority Toggle Tests
  // ============================================================================

  describe('Root authority toggling other sub-accounts', () => {
    test('ed25519 root can disable ed25519 sub-account', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with root authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(subAccountAuth.publicKey),
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];

      // Create sub-account (by the sub-account owner)
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      // Root disables the sub-account (cross-authority toggle)
      swig = fetchSwig(svm, swigAddress);
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        rootRole.id, // Root is the acting authority
        false, // enabled = false
        subAccountRole.id, // Target sub-account belongs to this role
      );
      sendSwigSVMTransaction(svm, toggleIx, root);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });

    test('secp256k1 root can disable ed25519 sub-account', async () => {
      const svm = getSvm();
      const [payer, subAccountAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256k1 root authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      let slot = svm.getClock().slot;

      // Add ed25519 sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(subAccountAuth.publicKey),
        Actions.set().subAccount().get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];

      // Ed25519 creates sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      // Secp256k1 root toggles sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        rootRole.id,
        false,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, toggleIx, payer);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });

    test('ed25519 root can disable secp256k1 sub-account', async () => {
      const svm = getSvm();
      const [root, payer] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpSubAccount = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add secp256k1 sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpSubAccount.authorityInfo,
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesBySecp256k1SignerAddress(
        secpSubAccount.address,
      )[0];
      let slot = svm.getClock().slot;

      // Secp256k1 creates sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpSubAccount.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Ed25519 root toggles sub-account
      swig = fetchSwig(svm, swigAddress);
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        rootRole.id,
        false,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, toggleIx, root);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });

    test('ed25519 root can disable secp256r1 sub-account', async () => {
      const svm = getSvm();
      const [root, payer] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpSubAccount = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add secp256r1 sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpSubAccount.authorityInfo,
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.roles[1];
      let slot = svm.getClock().slot;

      // Secp256r1 creates sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpSubAccount.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Ed25519 root toggles sub-account
      swig = fetchSwig(svm, swigAddress);
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        rootRole.id,
        false,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, toggleIx, root);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });

    test('secp256r1 root can disable ed25519 sub-account', async () => {
      const svm = getSvm();
      const [payer, subAccountAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256r1 root authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      let slot = svm.getClock().slot;

      // Add ed25519 sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(subAccountAuth.publicKey),
        Actions.set().subAccount().get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesByEd25519SignerPk(
        subAccountAuth.publicKey,
      )[0];

      // Ed25519 creates sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      // Secp256r1 root toggles sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        rootRole.id,
        false,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, toggleIx, payer);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });

    test('secp256r1 root can disable secp256k1 sub-account', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();
      const secpSubAccount = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256r1 root authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      let slot = svm.getClock().slot;

      // Add secp256k1 sub-account authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpSubAccount.authorityInfo,
        Actions.set().subAccount().get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.findRolesBySecp256k1SignerAddress(
        secpSubAccount.address,
      )[0];
      slot = svm.getClock().slot;

      // Secp256k1 creates sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpSubAccount.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Secp256r1 root toggles sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const toggleIx = await getToggleSubAccountInstructionContext(
        swig,
        rootRole.id,
        false,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, toggleIx, payer);

      // Verify transaction succeeded
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });
  });
});
