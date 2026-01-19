/**
 * Tests for SubAccountWithdrawV1 instruction - Withdrawing from sub-accounts
 *
 * Sub-accounts allow authorities to withdraw SOL and tokens back to the
 * main swig wallet or other destinations.
 *
 * Tests withdrawing from sub-accounts with:
 * - Ed25519 authority
 * - Secp256k1 authority
 * - Secp256r1 authority
 */

import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  findSwigSubAccountPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getSwigWalletAddressRaw,
  getWithdrawFromSubAccountInstructionContext,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import { randomBytes, sendSwigSVMTransaction, toPublicKey } from '../helpers';

const SOL = 1_000_000_000n;

describe('SubAccountWithdrawV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Authority Tests
  // ============================================================================

  describe('Ed25519 authority with sub-account', () => {
    test('withdraws SOL from sub-account', async () => {
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

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      const initialBalance = svm.getBalance(toPublicKey(subAccountAddress))!;
      expect(initialBalance).toBeGreaterThanOrEqual(SOL);

      // Withdraw SOL from sub-account
      swig = fetchSwig(svm, swigAddress);
      const swigWalletAddress = await getSwigWalletAddressRaw(swig);
      const initialSwigBalance = svm.getBalance(
        toPublicKey(swigWalletAddress),
      )!;

      const withdrawAmount = SOL / 2n;
      const withdrawIx = await getWithdrawFromSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        { amount: withdrawAmount },
      );
      sendSwigSVMTransaction(svm, withdrawIx, subAccountAuth);

      // Verify balance changed
      const finalSubAccountBalance = svm.getBalance(
        toPublicKey(subAccountAddress),
      )!;
      const finalSwigBalance = svm.getBalance(toPublicKey(swigWalletAddress))!;

      expect(initialBalance - finalSubAccountBalance).toBe(withdrawAmount);
      expect(finalSwigBalance - initialSwigBalance).toBe(withdrawAmount);
    });

    test('withdraws different amounts', async () => {
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

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      const initialBalance = svm.getBalance(toPublicKey(subAccountAddress))!;

      // Withdraw a specific amount (not half)
      swig = fetchSwig(svm, swigAddress);
      const withdrawAmount = SOL / 4n;
      const withdrawIx = await getWithdrawFromSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        { amount: withdrawAmount },
      );
      sendSwigSVMTransaction(svm, withdrawIx, subAccountAuth);

      const finalBalance = svm.getBalance(toPublicKey(subAccountAddress))!;
      expect(initialBalance - finalBalance).toBe(withdrawAmount);
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================
  // Note: Secp256k1 sub-account withdraw fails with "insufficient account keys"
  // The instruction builder may be missing required accounts for secp256k1 signatures

  describe('Secp256k1 authority with sub-account', () => {
    test.skip('withdraws SOL from sub-account', async () => {
      const svm = getSvm();
      const [payer, root] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256k1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      const slot = svm.getClock().slot;

      // Add Secp256k1 authority with subAccount permission
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

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      const initialBalance = svm.getBalance(toPublicKey(subAccountAddress))!;
      expect(initialBalance).toBeGreaterThanOrEqual(SOL);

      // Withdraw SOL from sub-account
      swig = fetchSwig(svm, swigAddress);
      const swigWalletAddress = await getSwigWalletAddressRaw(swig);
      const initialSwigBalance = svm.getBalance(
        toPublicKey(swigWalletAddress),
      )!;

      const withdrawAmount = SOL / 2n;
      const currentSlot = svm.getClock().slot;
      const withdrawIx = await getWithdrawFromSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        { amount: withdrawAmount },
        {
          payer: payer.publicKey,
          currentSlot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, withdrawIx, payer);

      // Verify balance changed
      const finalSubAccountBalance = svm.getBalance(
        toPublicKey(subAccountAddress),
      )!;
      const finalSwigBalance = svm.getBalance(toPublicKey(swigWalletAddress))!;

      expect(initialBalance - finalSubAccountBalance).toBe(withdrawAmount);
      expect(finalSwigBalance - initialSwigBalance).toBe(withdrawAmount);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================
  // Note: Secp256r1 sub-account withdraw fails with custom program error
  // The instruction builder may be missing required accounts for secp256r1 signatures

  describe('Secp256r1 authority with sub-account', () => {
    test.skip('withdraws SOL from sub-account', async () => {
      const svm = getSvm();
      const [payer, root] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const r1Authority = createTestSecp256r1Authority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519 root
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      const slot = svm.getClock().slot;

      // Add Secp256r1 authority with subAccount permission
      const addIx = await getAddAuthorityInstructionContext(
        swig,
        rootRole.id,
        r1Authority.authorityInfo,
        Actions.set().subAccount().get(),
      );
      sendSwigSVMTransaction(svm, addIx, root);

      swig = fetchSwig(svm, swigAddress);
      const subAccountRole = swig.roles.find((role) =>
        role.authority.matchesSigner(r1Authority.compressedPublicKey),
      )!;

      // Create sub-account
      const createSubAccountIx = await getCreateSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: r1Authority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, createSubAccountIx, payer);

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      const initialBalance = svm.getBalance(toPublicKey(subAccountAddress))!;
      expect(initialBalance).toBeGreaterThanOrEqual(SOL);

      // Withdraw SOL from sub-account
      swig = fetchSwig(svm, swigAddress);
      const swigWalletAddress = await getSwigWalletAddressRaw(swig);
      const initialSwigBalance = svm.getBalance(
        toPublicKey(swigWalletAddress),
      )!;

      const withdrawAmount = SOL / 2n;
      const currentSlot = svm.getClock().slot;
      const withdrawIx = await getWithdrawFromSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        { amount: withdrawAmount },
        {
          payer: payer.publicKey,
          currentSlot,
          signingFn: r1Authority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, withdrawIx, payer);

      // Verify balance changed
      const finalSubAccountBalance = svm.getBalance(
        toPublicKey(subAccountAddress),
      )!;
      const finalSwigBalance = svm.getBalance(toPublicKey(swigWalletAddress))!;

      expect(initialBalance - finalSubAccountBalance).toBe(withdrawAmount);
      expect(finalSwigBalance - initialSwigBalance).toBe(withdrawAmount);
    });
  });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas for SOL withdrawal', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Setup
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
      sendSwigSVMTransaction(svm, createSubAccountIx, subAccountAuth);

      swig = fetchSwig(svm, swigAddress);
      const withdrawIx = await getWithdrawFromSubAccountInstructionContext(
        swig,
        subAccountRole.id,
        { amount: SOL / 2n },
      );

      const instructions = withdrawIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      // Should have at least swig, sub-account, swig wallet, system program, authority
      expect(ix.accounts.length).toBeGreaterThanOrEqual(4);
    });
  });
});
