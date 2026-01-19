/**
 * Tests for UpdateAuthorityV1 instruction - Updating authority actions
 *
 * Tests updating authority actions with different strategies:
 * - ReplaceAll: Replace all actions for an authority
 * - AddActions: Add new actions to existing authority
 * - RemoveByType: Remove actions by permission type
 * - RemoveByIndex: Remove specific actions by index
 *
 * Tests with different authority types:
 * - Ed25519 authority
 * - Secp256k1 authority
 * - Secp256r1 authority
 */

import { Permission } from '@swig-wallet/coder';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSwigInstructionContext,
  getUpdateAuthorityInstructionContext,
  updateAuthorityAddActions,
  updateAuthorityRemoveByIndex,
  updateAuthorityRemoveByType,
  updateAuthorityReplaceAllActions,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction } from '../helpers';

const SOL = 1_000_000_000n;

describe('UpdateAuthorityV1 Instruction', () => {
  // ============================================================================
  // ReplaceAll Strategy Tests
  // ============================================================================

  describe('ReplaceAll strategy', () => {
    test('Ed25519 root replaces all actions for authority', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Add spender with SOL limit
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(spenderRole.actions.canSpendSol()).toBe(true);
      expect(spenderRole.actions.canManageAuthority()).toBe(false);

      // Update spender to have manageAuthority instead of solLimit
      const newActions = Actions.set().manageAuthority().get();
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityReplaceAllActions(newActions),
      );
      sendSwigSVMTransaction(svm, updateIx, root);

      // Verify actions changed
      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.canSpendSol()).toBe(false);
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
    });

    test('Ed25519 root replaces SOL limit amount', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
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

      // Add spender with initial SOL limit
      const initialLimit = SOL;
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: initialLimit }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(spenderRole.actions.solSpendLimit()).toBe(initialLimit);

      // Update to higher limit
      const newLimit = SOL * 5n;
      const newActions = Actions.set().solLimit({ amount: newLimit }).get();
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityReplaceAllActions(newActions),
      );
      sendSwigSVMTransaction(svm, updateIx, root);

      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.solSpendLimit()).toBe(newLimit);
    });
  });

  // ============================================================================
  // AddActions Strategy Tests
  // ============================================================================

  describe('AddActions strategy', () => {
    test('Ed25519 root adds actions to authority', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
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

      // Add spender with SOL limit only
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(spenderRole.actions.canSpendSol()).toBe(true);
      expect(spenderRole.actions.canManageAuthority()).toBe(false);

      // Add manageAuthority action
      const additionalActions = Actions.set().manageAuthority().get();
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityAddActions(additionalActions),
      );
      sendSwigSVMTransaction(svm, updateIx, root);

      // Verify both actions exist now
      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.canSpendSol()).toBe(true);
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
    });

    test('adds multiple actions at once', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
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

      // Add spender with just manageAuthority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().manageAuthority().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

      // Add multiple actions: SOL limit and programAll
      const additionalActions = Actions.set()
        .solLimit({ amount: SOL })
        .programAll()
        .get();
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityAddActions(additionalActions),
      );
      sendSwigSVMTransaction(svm, updateIx, root);

      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
      expect(updatedRole.actions.canSpendSol()).toBe(true);
      expect(updatedRole.actions.hasProgramAction()).toBe(true);
    });
  });

  // ============================================================================
  // RemoveByType Strategy Tests
  // ============================================================================

  describe('RemoveByType strategy', () => {
    test('Ed25519 root removes actions by permission type', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
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

      // Add spender with multiple permissions
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set()
          .solLimit({ amount: SOL })
          .manageAuthority()
          .programAll()
          .get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(spenderRole.actions.canSpendSol()).toBe(true);
      expect(spenderRole.actions.canManageAuthority()).toBe(true);

      // Remove SolLimit permission
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityRemoveByType([Permission.SolLimit]),
      );
      sendSwigSVMTransaction(svm, updateIx, root);

      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.canSpendSol()).toBe(false);
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
    });
  });

  // ============================================================================
  // RemoveByIndex Strategy Tests
  // ============================================================================

  describe('RemoveByIndex strategy', () => {
    test('Ed25519 root removes actions by index', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
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

      // Add spender with multiple permissions (order matters)
      // Note: ensureProgramAction adds ProgramAll automatically when no program action exists
      // Index 0: solLimit, Index 1: manageAuthority, Index 2: programAll (auto-added)
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: SOL }).manageAuthority().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      // 3 actions: solLimit, manageAuthority, and auto-added programAll
      expect(spenderRole.actions.count).toBe(3);
      expect(spenderRole.actions.canSpendSol()).toBe(true);
      expect(spenderRole.actions.canManageAuthority()).toBe(true);

      // Remove first action (index 0 - solLimit)
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityRemoveByIndex([0]),
      );
      sendSwigSVMTransaction(svm, updateIx, root);

      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.count).toBe(2);
      expect(updatedRole.actions.canSpendSol()).toBe(false);
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================

  describe('Secp256k1 root updating authority', () => {
    test('Secp256k1 root replaces authority actions', async () => {
      const svm = getSvm();
      const [payer, spender] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256k1 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpAuthority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.findRolesBySecp256k1SignerAddress(
        secpAuthority.address,
      )[0];
      const slot = svm.getClock().slot;

      // Add Ed25519 spender
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

      // Update spender's actions
      const newActions = Actions.set().manageAuthority().get();
      const currentSlot = svm.getClock().slot;
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityReplaceAllActions(newActions),
        {
          payer: payer.publicKey,
          currentSlot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, updateIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.canSpendSol()).toBe(false);
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================

  describe('Secp256r1 root updating authority', () => {
    test('Secp256r1 root replaces authority actions', async () => {
      const svm = getSvm();
      const [payer, spender] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const r1Authority = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with secp256r1 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: r1Authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles.find((role) =>
        role.authority.matchesSigner(r1Authority.compressedPublicKey),
      );
      expect(rootRole).toBeDefined();

      const slot = svm.getClock().slot;

      // Add Ed25519 spender
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole!.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: r1Authority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

      // Update spender's actions
      const newActions = Actions.set().manageAuthority().get();
      const currentSlot = svm.getClock().slot;
      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole!.id,
        spenderRole.id,
        updateAuthorityReplaceAllActions(newActions),
        {
          payer: payer.publicKey,
          currentSlot,
          signingFn: r1Authority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, updateIx, payer);

      swig = fetchSwig(svm, swigAddress);
      const updatedRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(updatedRole.actions.canSpendSol()).toBe(false);
      expect(updatedRole.actions.canManageAuthority()).toBe(true);
    });
  });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Setup swig
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

      const updateIx = await getUpdateAuthorityInstructionContext(
        swig,
        rootRole.id,
        spenderRole.id,
        updateAuthorityReplaceAllActions(Actions.set().manageAuthority().get()),
      );

      const instructions = updateIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      // Should have at least swig, payer, system program, authority
      expect(ix.accounts.length).toBeGreaterThanOrEqual(3);
    });
  });
});
