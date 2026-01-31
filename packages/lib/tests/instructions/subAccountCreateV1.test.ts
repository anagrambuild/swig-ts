/**
 * Tests for SubAccountCreateV1 instruction - Creating sub-accounts for Swig authorities
 *
 * Sub-accounts are derived accounts that can be created for authorities with
 * the subAccount permission. They allow an authority to manage a separate
 * account that can hold and transfer assets.
 *
 * Tests creating sub-accounts with:
 * - Ed25519 authority (with subAccount permission)
 * - Secp256k1 authority (with subAccount permission)
 * - Secp256r1 authority (with subAccount permission)
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  findSwigSubAccountPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
} from '../../src';
import {
  fetchSwig,
  getFundedKeys,
  getSvm,
  getSvmWithTestProgram,
} from '../context';
import {
  createTestProgramExecAuthority,
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import {
  createTestProgramPreInstruction,
  randomBytes,
  sendSwigSVMTransaction,
  toPublicKey,
} from '../helpers';

describe('SubAccountCreateV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Authority Tests
  // ============================================================================

  describe('Ed25519 authority with subAccount permission', () => {
    test('creates sub-account', async () => {
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

      // Add authority with subAccount permission
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

      // The sub-account should now exist with some rent-exempt minimum
      const subAccountBalance = svm.getBalance(toPublicKey(subAccountAddress));
      expect(subAccountBalance).toBeGreaterThan(0n);
    });

    test('sub-account address is deterministic', async () => {
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

      // Calculate expected sub-account address before creation
      const [expectedAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );

      // Create sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      // Verify the address matches
      const subAccountBalance = svm.getBalance(toPublicKey(expectedAddress));
      expect(subAccountBalance).toBeGreaterThan(0n);
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================

  describe('Secp256k1 authority with subAccount permission', () => {
    test('creates sub-account', async () => {
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
      const slot = svm.getClock().slot;

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

      // Verify sub-account was created
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      const subAccountBalance = svm.getBalance(toPublicKey(subAccountAddress));
      expect(subAccountBalance).toBeGreaterThan(0n);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================

  describe('Secp256r1 authority with subAccount permission', () => {
    test('creates sub-account', async () => {
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
      const slot = svm.getClock().slot;

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

      // Verify sub-account was created
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      const subAccountBalance = svm.getBalance(toPublicKey(subAccountAddress));
      expect(subAccountBalance).toBeGreaterThan(0n);
    });
  });

  // ============================================================================
  // ProgramExec Authority Tests
  // ============================================================================

  describe('ProgramExec authority with subAccount permission', () => {
    test('creates sub-account', async () => {
      const svm = getSvmWithTestProgram();
      const [payer, root] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const programExecAuthority = createTestProgramExecAuthority();

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

      // Add ProgramExec authority with subAccount permission
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        programExecAuthority.authorityInfo,
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.roles[1];

      // Create preceding instruction for ProgramExec validation
      const precedingIx = createTestProgramPreInstruction(
        swigAddress,
        payer.publicKey,
      );

      // Create sub-account using ProgramExec authority
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        { payer: payer.publicKey, preInstructions: [precedingIx] },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Verify sub-account was created
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      const subAccountBalance = svm.getBalance(toPublicKey(subAccountAddress));
      expect(subAccountBalance).toBeGreaterThan(0n);
    });
  });

  // ============================================================================
  // Root with SubAccount Permission
  // ============================================================================
  // Note: Root authorities (with All permission) cannot create sub-accounts directly.
  // Sub-account creation requires explicit subAccount permission.

  // describe('Root authority with subAccount permission', () => {
  //   test.skip('root can create sub-account directly', async () => {
  //     // Root authority needs explicit subAccount permission
  //     // The All permission doesn't include subAccount by default
  //   });
  // });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
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

      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
      );

      const instructions = createSubAccountIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      // Should have at least swig, payer, sub-account, system program
      expect(ix.accounts.length).toBeGreaterThanOrEqual(3);
    });
  });
});
