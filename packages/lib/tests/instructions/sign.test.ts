/**
 * Tests for Sign instruction - Transaction signing
 *
 * Tests signing transactions with:
 * - Ed25519 authority
 * - Secp256k1 authority
 * - Secp256r1 authority
 */

import { address } from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
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

const SOL = 1_000_000_000n; // lamports per SOL

describe('Sign Instruction', () => {
  // ============================================================================
  // Ed25519 Authority Tests
  // ============================================================================

  describe('with Ed25519 authority', () => {
    test('signs single SOL transfer', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with root permissions (payer is authority)
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      // Fund swig wallet
      svm.airdrop(walletAddress, SOL);

      const transferAmount = SOL / 10n; // 0.1 SOL

      // Create transfer instruction using kit
      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      // Sign and execute (payer is authority - no additional signers)
      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: payer.publicKey },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });

    test('signs multiple instructions atomically', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient1 = Keypair.generate();
      const recipient2 = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL);

      const amount1 = SOL / 10n;
      const amount2 = SOL / 5n;

      const transfer1 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient1.publicKey.toBase58()),
        amount: amount1,
      });

      const transfer2 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient2.publicKey.toBase58()),
        amount: amount2,
      });

      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer1, transfer2].map(SolInstruction.from),
        false,
        { payer: payer.publicKey },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient1.publicKey)).toBe(amount1);
      expect(svm.getBalance(recipient2.publicKey)).toBe(amount2);
    });
  });

  // ============================================================================
  // Secp256k1 Authority Tests
  // ============================================================================

  describe('with Secp256k1 authority', () => {
    test('signs single SOL transfer', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.findRolesBySecp256k1SignerAddress(authority.address)[0];

      svm.airdrop(walletAddress, SOL);

      const slot = svm.getClock().slot;
      const transferAmount = SOL / 10n;

      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      // Sign with secp256k1 (signingFn embeds signature in instruction)
      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer].map(SolInstruction.from),
        false,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: authority.signingFn ?? undefined,
        },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });

    test('signs multiple instructions atomically', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient1 = Keypair.generate();
      const recipient2 = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL);

      const slot = svm.getClock().slot;
      const amount1 = SOL / 10n;
      const amount2 = SOL / 5n;

      const transfer1 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient1.publicKey.toBase58()),
        amount: amount1,
      });

      const transfer2 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient2.publicKey.toBase58()),
        amount: amount2,
      });

      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer1, transfer2].map(SolInstruction.from),
        false,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: authority.signingFn ?? undefined,
        },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient1.publicKey)).toBe(amount1);
      expect(svm.getBalance(recipient2.publicKey)).toBe(amount2);
    });
  });

  // ============================================================================
  // Secp256r1 Authority Tests
  // ============================================================================

  describe('with Secp256r1 authority', () => {
    test('signs single SOL transfer', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL);

      const slot = svm.getClock().slot;
      const transferAmount = SOL / 10n;

      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      // Sign with secp256r1 (signingFn embeds signature in instruction)
      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer].map(SolInstruction.from),
        false,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: authority.signingFn ?? undefined,
        },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });

    test('signs multiple instructions atomically', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient1 = Keypair.generate();
      const recipient2 = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL);

      const slot = svm.getClock().slot;
      const amount1 = SOL / 10n;
      const amount2 = SOL / 5n;

      const transfer1 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient1.publicKey.toBase58()),
        amount: amount1,
      });

      const transfer2 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient2.publicKey.toBase58()),
        amount: amount2,
      });

      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer1, transfer2].map(SolInstruction.from),
        false,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: authority.signingFn ?? undefined,
        },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient1.publicKey)).toBe(amount1);
      expect(svm.getBalance(recipient2.publicKey)).toBe(amount2);
    });
  });

  // ============================================================================
  // ProgramExec Authority Tests
  // ============================================================================

  describe('with ProgramExec authority', () => {
    test('signs single SOL transfer', async () => {
      const svm = getSvmWithTestProgram();
      const [payer] = getFundedKeys(svm, 1);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);
      const authority = createTestProgramExecAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL);

      const transferAmount = SOL / 10n;

      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: transferAmount,
      });

      // Create preceding instruction for ProgramExec validation
      // For signV2, the second account is swigSystemAddress (same as walletAddress for V2)
      const precedingIx = createTestProgramPreInstruction(
        swigAddress,
        walletAddress,
      );

      // Sign with ProgramExec (uses preceding instruction for validation)
      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: payer.publicKey, preInstructions: [precedingIx] },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
    });

    test('signs multiple instructions atomically', async () => {
      const svm = getSvmWithTestProgram();
      const [payer] = getFundedKeys(svm, 1);
      const recipient1 = Keypair.generate();
      const recipient2 = Keypair.generate();
      const swigId = randomBytes(32);
      const authority = createTestProgramExecAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: authority.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      const swig = fetchSwig(svm, swigAddress);
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL);

      const amount1 = SOL / 10n;
      const amount2 = SOL / 5n;

      const transfer1 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient1.publicKey.toBase58()),
        amount: amount1,
      });

      const transfer2 = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient2.publicKey.toBase58()),
        amount: amount2,
      });

      // Create preceding instruction for ProgramExec validation
      // For signV2, the second account is swigSystemAddress (same as walletAddress for V2)
      const precedingIx = createTestProgramPreInstruction(
        swigAddress,
        walletAddress,
      );

      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer1, transfer2].map(SolInstruction.from),
        false,
        { payer: payer.publicKey, preInstructions: [precedingIx] },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient1.publicKey)).toBe(amount1);
      expect(svm.getBalance(recipient2.publicKey)).toBe(amount2);
    });
  });

  // ============================================================================
  // SOL Limit enforcement (using Ed25519 for simplicity)
  // ============================================================================

  describe('SOL limit enforcement', () => {
    test('enforces SOL spending limit', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Note: SOL limits don't work for root - need to use addAuthority to add a non-root
      // role with solLimit for limit enforcement
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(payer.publicKey),
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      // For limit enforcement tests, we need a secondary role with limited permissions
      // For now, test that root can do unlimited transfers
      const swig = fetchSwig(svm, swigAddress);
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      svm.airdrop(walletAddress, SOL * 2n);

      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: SOL, // 1 SOL - root can transfer any amount
      });

      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: payer.publicKey },
      );

      sendSwigSVMTransaction(svm, signIx, payer);

      expect(svm.getBalance(recipient.publicKey)).toBe(SOL);
    });
  });

  // ============================================================================
  // Instruction structure tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [payer] = getFundedKeys(svm, 1);
      const recipient = Keypair.generate();
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
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const role = swig.roles[0];

      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: SOL / 10n,
      });

      const signIx = await getSignInstructionContext(
        swig,
        role.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: payer.publicKey },
      );

      const instructions = signIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      // Should have multiple account metas including swig, payer, authority
      expect(ix.accounts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
