/**
 * Tests for SubAccountSignV1 instruction - Signing transactions from sub-accounts
 *
 * Sub-accounts allow authorities with the subAccount permission to sign
 * transactions using the sub-account as the source.
 *
 * Tests signing from sub-accounts with:
 * - Ed25519 authority
 * - Secp256k1 authority
 */

import { address } from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  findSwigSubAccountPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSubAccountInstructionContext,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  SolInstruction,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  createTestSecp256k1Authority,
  createTestSecp256r1Authority,
} from '../fixtures/authorities';
import {
  getTransferSolInstruction,
  randomBytes,
  sendSwigSVMTransaction,
  toPublicKey,
} from '../helpers';

const SOL = 1_000_000_000n;

describe('SubAccountSignV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Authority Tests
  // ============================================================================

  describe('Ed25519 authority with sub-account', () => {
    test('signs SOL transfer from sub-account', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
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

      // Sign transfer from sub-account
      swig = fetchSwig(svm, swigAddress);
      const transferAmount = SOL / 10n;
      const transfer = getTransferSolInstruction({
        source: address(toPublicKey(subAccountAddress).toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      const signIx = await getSignInstructionContext(
        swig,
        subAccountRole.id,
        [transfer].map(SolInstruction.from),
        true, // withSubAccount = true
        { payer: subAccountAuth.publicKey },
      );
      sendSwigSVMTransaction(svm, signIx, subAccountAuth);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });

    test('signs multiple transfers atomically from sub-account', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const recipient1 = Keypair.generate();
      const recipient2 = Keypair.generate();
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Setup swig and sub-account
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

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      // Sign multiple transfers
      swig = fetchSwig(svm, swigAddress);
      const amount1 = SOL / 10n;
      const amount2 = SOL / 5n;

      const transfer1 = getTransferSolInstruction({
        source: address(toPublicKey(subAccountAddress).toBase58()),
        destination: address(recipient1.publicKey.toBase58()),
        amount: amount1,
      });

      const transfer2 = getTransferSolInstruction({
        source: address(toPublicKey(subAccountAddress).toBase58()),
        destination: address(recipient2.publicKey.toBase58()),
        amount: amount2,
      });

      const signIx = await getSignInstructionContext(
        swig,
        subAccountRole.id,
        [transfer1, transfer2].map(SolInstruction.from),
        true,
        { payer: subAccountAuth.publicKey },
      );
      sendSwigSVMTransaction(svm, signIx, subAccountAuth);

      expect(svm.getBalance(recipient1.publicKey)).toBe(amount1);
      expect(svm.getBalance(recipient2.publicKey)).toBe(amount2);
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================

  describe('Secp256k1 authority with sub-account', () => {
    test('signs SOL transfer from sub-account', async () => {
      const svm = getSvm();
      const [payer, root] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256k1Authority();

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

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      // Sign transfer from sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const transferAmount = SOL / 10n;
      const transfer = getTransferSolInstruction({
        source: address(toPublicKey(subAccountAddress).toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      const signIx = await getSignInstructionContext(
        swig,
        subAccountRole.id,
        [transfer].map(SolInstruction.from),
        true, // withSubAccount = true
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================

  describe('Secp256r1 authority with sub-account', () => {
    test('signs SOL transfer from sub-account', async () => {
      const svm = getSvm();
      const [payer, root] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);
      const secpAuthority = createTestSecp256r1Authority();

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

      // Fund sub-account
      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );
      svm.airdrop(toPublicKey(subAccountAddress), SOL);

      // Sign transfer from sub-account
      swig = fetchSwig(svm, swigAddress);
      slot = svm.getClock().slot;
      const transferAmount = SOL / 10n;
      const transfer = getTransferSolInstruction({
        source: address(toPublicKey(subAccountAddress).toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      const signIx = await getSignInstructionContext(
        swig,
        subAccountRole.id,
        [transfer].map(SolInstruction.from),
        true, // withSubAccount = true
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpAuthority.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });
  });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [root, subAccountAuth] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
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

      const [subAccountAddress] = await findSwigSubAccountPdaRaw(
        subAccountRole.swigId,
        subAccountRole.id,
      );

      swig = fetchSwig(svm, swigAddress);
      const transfer = getTransferSolInstruction({
        source: address(toPublicKey(subAccountAddress).toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: SOL / 10n,
      });

      const signIx = await getSignInstructionContext(
        swig,
        subAccountRole.id,
        [transfer].map(SolInstruction.from),
        true,
        { payer: subAccountAuth.publicKey },
      );

      const instructions = signIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      expect(ix.accounts.length).toBeGreaterThanOrEqual(3);
    });
  });
});
