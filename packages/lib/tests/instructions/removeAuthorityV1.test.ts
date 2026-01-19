/**
 * Tests for RemoveAuthorityV1 instruction - Removing authorities from Swig
 *
 * Tests removing authorities with:
 * - Ed25519 authority (as acting authority)
 * - Secp256k1 authority (as acting authority)
 * - Secp256r1 authority (as acting authority)
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSwigInstructionContext,
  getRemoveAuthorityInstructionContext,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction } from '../helpers';

const SOL = 1_000_000_000n;

describe('RemoveAuthorityV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Root Removing Authorities
  // ============================================================================

  describe('Ed25519 root removing authorities', () => {
    test('removes Ed25519 authority', async () => {
      const svm = getSvm();
      const [root, toRemove] = getFundedKeys(svm, 2);
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

      // Add authority to remove
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(toRemove.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.findRolesByEd25519SignerPk(
        toRemove.publicKey,
      )[0];

      // Remove authority
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
      );
      sendSwigSVMTransaction(svm, removeIx, root);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      const removedRoles = swig.findRolesByEd25519SignerPk(toRemove.publicKey);
      expect(removedRoles.length).toBe(0);
    });

    test('removes Secp256k1 authority', async () => {
      const svm = getSvm();
      const [root] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add secp256k1 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpAuthority.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.findRolesBySecp256k1SignerAddress(
        secpAuthority.address,
      )[0];

      // Remove authority
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
      );
      sendSwigSVMTransaction(svm, removeIx, root);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      const removedRoles = swig.findRolesBySecp256k1SignerAddress(
        secpAuthority.address,
      );
      expect(removedRoles.length).toBe(0);
    });

    test('removes Secp256r1 authority', async () => {
      const svm = getSvm();
      const [root] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add secp256r1 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpAuthority.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      // Get the second role (secp256r1)
      const roleToRemove = swig.roles[1];

      // Remove authority
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
      );
      sendSwigSVMTransaction(svm, removeIx, root);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(1);
    });
  });

  // ============================================================================
  // Secp256k1 Root Removing Authorities
  // ============================================================================

  describe('Secp256k1 root removing authorities', () => {
    test('removes Ed25519 authority', async () => {
      const svm = getSvm();
      const [payer, toRemove] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256k1 root
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

      // Add ed25519 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(toRemove.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.findRolesByEd25519SignerPk(
        toRemove.publicKey,
      )[0];

      // Remove authority
      slot = svm.getClock().slot;
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, removeIx, payer);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      const removedRoles = swig.findRolesByEd25519SignerPk(toRemove.publicKey);
      expect(removedRoles.length).toBe(0);
    });

    test('removes Secp256k1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();
      const secpToRemove = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256k1 root
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

      // Add another secp256k1 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpToRemove.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.findRolesBySecp256k1SignerAddress(
        secpToRemove.address,
      )[0];

      // Remove authority
      slot = svm.getClock().slot;
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, removeIx, payer);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      const removedRoles = swig.findRolesBySecp256k1SignerAddress(
        secpToRemove.address,
      );
      expect(removedRoles.length).toBe(0);
    });

    test('removes Secp256r1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();
      const secpToRemove = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256k1 root
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

      // Add secp256r1 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpToRemove.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.roles[1]; // secp256r1 is at index 1

      // Remove authority
      slot = svm.getClock().slot;
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, removeIx, payer);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(1);
    });
  });

  // ============================================================================
  // Secp256r1 Root Removing Authorities
  // ============================================================================

  describe('Secp256r1 root removing authorities', () => {
    test('removes Ed25519 authority', async () => {
      const svm = getSvm();
      const [payer, toRemove] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256r1 root
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

      // Add ed25519 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(toRemove.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.findRolesByEd25519SignerPk(
        toRemove.publicKey,
      )[0];

      // Remove authority
      slot = svm.getClock().slot;
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, removeIx, payer);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      const removedRoles = swig.findRolesByEd25519SignerPk(toRemove.publicKey);
      expect(removedRoles.length).toBe(0);
    });

    test('removes Secp256k1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();
      const secpToRemove = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256r1 root
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

      // Add secp256k1 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpToRemove.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.findRolesBySecp256k1SignerAddress(
        secpToRemove.address,
      )[0];

      // Remove authority
      slot = svm.getClock().slot;
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, removeIx, payer);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      const removedRoles = swig.findRolesBySecp256k1SignerAddress(
        secpToRemove.address,
      );
      expect(removedRoles.length).toBe(0);
    });

    test('removes Secp256r1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();
      const secpToRemove = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256r1 root
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

      // Add another secp256r1 authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpToRemove.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const roleToRemove = swig.roles[1]; // secp256r1 is at index 1

      // Remove authority
      slot = svm.getClock().slot;
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, removeIx, payer);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(1);
    });
  });

  // ============================================================================
  // Manager Removing Authorities
  // ============================================================================

  describe('Manager removing authorities', () => {
    test('manager can remove authority', async () => {
      const svm = getSvm();
      const [root, manager, toRemove] = getFundedKeys(svm, 3);
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

      // Add manager
      const addManagerIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(manager.publicKey),
        Actions.set().manageAuthority().get(),
      );
      sendSwigSVMTransaction(svm, addManagerIx, root);

      swig = fetchSwig(svm, swigAddress);
      const managerRole = swig.findRolesByEd25519SignerPk(manager.publicKey)[0];

      // Manager adds authority to remove
      const addToRemoveIx = await getAddAuthorityInstructionContext(
        swig,
        managerRole.id,
        createEd25519AuthorityInfo(toRemove.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addToRemoveIx, manager);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(3);

      const roleToRemove = swig.findRolesByEd25519SignerPk(
        toRemove.publicKey,
      )[0];

      // Manager removes authority
      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        managerRole.id,
        roleToRemove.id,
      );
      sendSwigSVMTransaction(svm, removeIx, manager);

      // Verify authority was removed
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
      const removedRoles = swig.findRolesByEd25519SignerPk(toRemove.publicKey);
      expect(removedRoles.length).toBe(0);
    });
  });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [root, toRemove] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add authority to remove
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(toRemove.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const roleToRemove = swig.findRolesByEd25519SignerPk(
        toRemove.publicKey,
      )[0];

      const removeIx = await getRemoveAuthorityInstructionContext(
        swig,
        rootRole.id,
        roleToRemove.id,
      );

      const instructions = removeIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      expect(ix.accounts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
