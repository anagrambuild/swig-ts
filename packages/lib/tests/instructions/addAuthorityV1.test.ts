/**
 * Tests for AddAuthorityV1 instruction - Adding new authorities to Swig
 *
 * Tests adding authorities with:
 * - Ed25519 authority (as root and added)
 * - Secp256k1 authority (as root and added)
 * - Secp256r1 authority (as root and added)
 */

import { address } from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import {
  Actions,
  AddMultipleAuthoritiesInstructionContextBuilder,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  getSwigWalletAddressRaw,
  SolInstruction,
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
  getTransferSolInstruction,
  randomBytes,
  sendSwigSVMTransaction,
  toPublicKey,
} from '../helpers';

const SOL = 1_000_000_000n;

describe('AddAuthorityV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Root Adding Authorities
  // ============================================================================

  describe('Ed25519 root adding authorities', () => {
    test('adds Ed25519 authority with manageAuthority permission', async () => {
      const svm = getSvm();
      const [root, manager] = getFundedKeys(svm, 2);
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

      // Add manager authority
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(manager.publicKey),
        Actions.set().manageAuthority().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      // Verify manager was added
      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const managerRole = swig.findRolesByEd25519SignerPk(manager.publicKey)[0];
      expect(managerRole).toBeDefined();
      expect(managerRole.actions.canManageAuthority()).toBe(true);
    });

    test('adds Ed25519 authority with SOL limit', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
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

      const solLimit = SOL / 2n;
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: solLimit }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
      expect(spenderRole).toBeDefined();
      expect(spenderRole.actions.canSpendSol()).toBe(true);
      expect(spenderRole.actions.solSpendLimit()).toBe(solLimit);
    });

    test('adds Secp256k1 authority', async () => {
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

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpAuthority.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const secpRole = swig.findRolesBySecp256k1SignerAddress(
        secpAuthority.address,
      )[0];
      expect(secpRole).toBeDefined();
    });

    test('adds Secp256r1 authority', async () => {
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

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpAuthority.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });
  });

  // ============================================================================
  // Secp256k1 Root Adding Authorities
  // ============================================================================

  describe('Secp256k1 root adding authorities', () => {
    test('adds Ed25519 authority', async () => {
      const svm = getSvm();
      const [payer, newAuthority] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.findRolesBySecp256k1SignerAddress(
        secpRoot.address,
      )[0];
      const slot = svm.getClock().slot;

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(newAuthority.publicKey),
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

      const newRole = swig.findRolesByEd25519SignerPk(
        newAuthority.publicKey,
      )[0];
      expect(newRole).toBeDefined();
    });

    test('adds Secp256k1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();
      const secpNew = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.findRolesBySecp256k1SignerAddress(
        secpRoot.address,
      )[0];
      const slot = svm.getClock().slot;

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpNew.authorityInfo,
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

      const newRole = swig.findRolesBySecp256k1SignerAddress(
        secpNew.address,
      )[0];
      expect(newRole).toBeDefined();
    });

    test('adds Secp256r1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1Authority();
      const secpNew = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.findRolesBySecp256k1SignerAddress(
        secpRoot.address,
      )[0];
      const slot = svm.getClock().slot;

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpNew.authorityInfo,
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
    });
  });

  // ============================================================================
  // Secp256r1 Root Adding Authorities
  // ============================================================================

  describe('Secp256r1 root adding authorities', () => {
    test('adds Ed25519 authority', async () => {
      const svm = getSvm();
      const [payer, newAuthority] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      const slot = svm.getClock().slot;

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(newAuthority.publicKey),
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

      const newRole = swig.findRolesByEd25519SignerPk(
        newAuthority.publicKey,
      )[0];
      expect(newRole).toBeDefined();
    });

    test('adds Secp256k1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();
      const secpNew = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      const slot = svm.getClock().slot;

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpNew.authorityInfo,
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

      const newRole = swig.findRolesBySecp256k1SignerAddress(
        secpNew.address,
      )[0];
      expect(newRole).toBeDefined();
    });

    test('adds Secp256r1 authority', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256r1Authority();
      const secpNew = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      const slot = svm.getClock().slot;

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpNew.authorityInfo,
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
    });
  });

  // ============================================================================
  // ProgramExec Root Adding Authorities
  // ============================================================================

  describe('ProgramExec root adding authorities', () => {
    test('adds Ed25519 authority', async () => {
      const svm = getSvmWithTestProgram();
      const [payer, newAuthority] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const programExecRoot = createTestProgramExecAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with ProgramExec root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: programExecRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Create preceding instruction for ProgramExec validation
      const precedingIx = createTestProgramPreInstruction(
        swigAddress,
        payer.publicKey,
      );

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(newAuthority.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
        { payer: payer.publicKey, preInstructions: [precedingIx] },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const newRole = swig.findRolesByEd25519SignerPk(
        newAuthority.publicKey,
      )[0];
      expect(newRole).toBeDefined();
    });

    test('adds Secp256k1 authority', async () => {
      const svm = getSvmWithTestProgram();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const programExecRoot = createTestProgramExecAuthority();
      const secpNew = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: programExecRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Create preceding instruction for ProgramExec validation
      const precedingIx = createTestProgramPreInstruction(
        swigAddress,
        payer.publicKey,
      );

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpNew.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
        { payer: payer.publicKey, preInstructions: [precedingIx] },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);

      const newRole = swig.findRolesBySecp256k1SignerAddress(
        secpNew.address,
      )[0];
      expect(newRole).toBeDefined();
    });

    test('adds Secp256r1 authority', async () => {
      const svm = getSvmWithTestProgram();
      const [payer] = getFundedKeys(svm, 1);
      const swigId = randomBytes(32);
      const programExecRoot = createTestProgramExecAuthority();
      const secpNew = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: programExecRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Create preceding instruction for ProgramExec validation
      const precedingIx = createTestProgramPreInstruction(
        swigAddress,
        payer.publicKey,
      );

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        secpNew.authorityInfo,
        Actions.set().solLimit({ amount: SOL }).get(),
        { payer: payer.publicKey, preInstructions: [precedingIx] },
      );
      sendSwigSVMTransaction(svm, addIx, payer);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(2);
    });
  });

  // ============================================================================
  // Manager Adding Authorities
  // ============================================================================

  describe('Manager adding authorities', () => {
    test('manager can add new authority', async () => {
      const svm = getSvm();
      const [root, manager, newAuthority] = getFundedKeys(svm, 3);
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

      // Manager adds new authority
      const addNewIx = await getAddAuthorityInstructionContext(
        swig,
        managerRole.id,
        createEd25519AuthorityInfo(newAuthority.publicKey),
        Actions.set().solLimit({ amount: SOL }).get(),
      );
      sendSwigSVMTransaction(svm, addNewIx, manager);

      swig = fetchSwig(svm, swigAddress);
      expect(swig.roles.length).toBe(3);

      const newRole = swig.findRolesByEd25519SignerPk(
        newAuthority.publicKey,
      )[0];
      expect(newRole).toBeDefined();
    });
  });

  // ============================================================================
  // Added Authority Can Use Permissions
  // ============================================================================

  describe('Added authority permissions', () => {
    test('added authority can use SOL limit', async () => {
      const svm = getSvm();
      const [root, spender] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const rootRole = swig.roles[0];

      // Fund wallet
      svm.airdrop(walletAddress, SOL);

      // Add spender with 0.1 SOL limit
      const solLimit = SOL / 10n;
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(spender.publicKey),
        Actions.set().solLimit({ amount: solLimit }).get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

      // Spender transfers within limit
      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: solLimit,
      });

      const signIx = await getSignInstructionContext(
        swig,
        spenderRole.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: spender.publicKey },
      );
      sendSwigSVMTransaction(svm, signIx, spender);

      expect(svm.getBalance(recipient.publicKey)).toBe(solLimit);
    });
  });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [root, newAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(newAuth.publicKey),
        Actions.set().manageAuthority().get(),
      );

      const instructions = addIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      expect(ix.accounts.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // AddMultipleAuthoritiesInstructionContextBuilder
  // ============================================================================

  describe('AddMultipleAuthoritiesInstructionContextBuilder', () => {
    test('chains multiple addAuthority calls', async () => {
      const svm = getSvm();
      const [root, auth1, auth2, auth3] = getFundedKeys(svm, 4);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      const builder = AddMultipleAuthoritiesInstructionContextBuilder.create({
        swigAddress,
        authority: rootRole.authority,
        roleId: rootRole.id,
      });

      builder
        .addAuthority(
          createEd25519AuthorityInfo(auth1.publicKey),
          Actions.set().manageAuthority().get(),
        )
        .addAuthority(
          createEd25519AuthorityInfo(auth2.publicKey),
          Actions.set().solLimit({ amount: SOL }).get(),
        )
        .addAuthority(
          createEd25519AuthorityInfo(auth3.publicKey),
          Actions.set().programAll().get(),
        );

      const contexts = await builder.getInstructionContexts();
      expect(contexts.length).toBe(3);

      // Execute all instructions
      for (const ctx of contexts) {
        sendSwigSVMTransaction(svm, ctx, root);
      }

      const updatedSwig = fetchSwig(svm, swigAddress);
      expect(updatedSwig.roles.length).toBe(4);
    });

    test('getInstructionContexts returns all contexts', async () => {
      const svm = getSvm();
      const [root, auth1, auth2] = getFundedKeys(svm, 3);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      const builder = AddMultipleAuthoritiesInstructionContextBuilder.create({
        swigAddress,
        authority: rootRole.authority,
        roleId: rootRole.id,
      });

      builder
        .addAuthority(
          createEd25519AuthorityInfo(auth1.publicKey),
          Actions.set().manageAuthority().get(),
        )
        .addAuthority(
          createEd25519AuthorityInfo(auth2.publicKey),
          Actions.set().solLimit({ amount: SOL }).get(),
        );

      const contexts = await builder.getInstructionContexts();

      expect(contexts.length).toBe(2);
      expect(contexts[0]).toBeDefined();
      expect(contexts[1]).toBeDefined();
    });

    test('works with mixed authority types', async () => {
      const svm = getSvm();
      const [root, ed25519Auth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpAuth = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      const builder = AddMultipleAuthoritiesInstructionContextBuilder.create({
        swigAddress,
        authority: rootRole.authority,
        roleId: rootRole.id,
      });

      builder
        .addAuthority(
          createEd25519AuthorityInfo(ed25519Auth.publicKey),
          Actions.set().manageAuthority().get(),
        )
        .addAuthority(
          secpAuth.authorityInfo,
          Actions.set().solLimit({ amount: SOL }).get(),
        );

      const contexts = await builder.getInstructionContexts();

      for (const ctx of contexts) {
        sendSwigSVMTransaction(svm, ctx, root);
      }

      const updatedSwig = fetchSwig(svm, swigAddress);
      expect(updatedSwig.roles.length).toBe(3);

      const ed25519Role = updatedSwig.findRolesByEd25519SignerPk(
        ed25519Auth.publicKey,
      )[0];
      const secpRole = updatedSwig.findRolesBySecp256k1SignerAddress(
        secpAuth.address,
      )[0];

      expect(ed25519Role).toBeDefined();
      expect(secpRole).toBeDefined();
    });

    test('includes create swig instruction when provided', async () => {
      const svm = getSvm();
      const [root, auth1] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig first to get authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // For the test, we'll create a new swig and chain add authority
      const newSwigId = randomBytes(32);
      const [newSwigAddress] = await findSwigPdaRaw(newSwigId);

      const newCreateIxPromise = getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: newSwigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });

      const builder = AddMultipleAuthoritiesInstructionContextBuilder.create({
        swigAddress: newSwigAddress,
        authority: rootRole.authority,
        roleId: 0,
        options: {
          createSwigInstructionContextPromise: newCreateIxPromise,
        },
      });

      builder.addAuthority(
        createEd25519AuthorityInfo(auth1.publicKey),
        Actions.set().manageAuthority().get(),
      );

      const contexts = await builder.getInstructionContexts();

      // Should include both create swig and add authority
      expect(contexts.length).toBe(2);

      // Execute create swig first, then add authority
      for (const ctx of contexts) {
        sendSwigSVMTransaction(svm, ctx, root);
      }

      const newSwig = fetchSwig(svm, newSwigAddress);
      expect(newSwig.roles.length).toBe(2);
    });
  });
});
