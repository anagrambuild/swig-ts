/**
 * Tests for CreateSessionV1 instruction - Creating sessions for Swig authorities
 *
 * Sessions can only be created for session-based authority types:
 * - Ed25519Session authority
 * - Secp256k1Session authority
 * - Secp256r1Session authority
 *
 * A session allows a different key (the session key) to sign transactions
 * on behalf of the authority for a limited duration.
 */

import { address } from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import {
  Actions,
  createEd25519SessionAuthorityInfo,
  findSwigPdaRaw,
  getCreateSessionInstructionContext,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  getSwigWalletAddressRaw,
  SolInstruction,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import { createTestSecp256k1SessionAuthority } from '../fixtures/authorities';
import {
  getTransferSolInstruction,
  randomBytes,
  sendSwigSVMTransaction,
  toPublicKey,
} from '../helpers';

const SOL = 1_000_000_000n;

describe('CreateSessionV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Session Tests
  // ============================================================================

  describe('Ed25519 session authority', () => {
    test('creates session with Ed25519 session authority', async () => {
      const svm = getSvm();
      const [rootAuthority, sessionKeypair] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519Session authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(
          rootAuthority.publicKey,
          100n,
        ),
        id: swigId,
        payer: rootAuthority.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, rootAuthority);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];
      expect(rootRole).toBeDefined();

      // Create session
      const sessionIx = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        sessionKeypair.publicKey,
        50n,
      );
      sendSwigSVMTransaction(svm, sessionIx, rootAuthority);

      // Verify session was created
      swig = fetchSwig(svm, swigAddress);
      const sessionRole = swig.findRoleBySessionKey(sessionKeypair.publicKey);
      expect(sessionRole).toBeDefined();
      expect(sessionRole!.isSessionBased()).toBe(true);
    });

    test('session key can sign transactions', async () => {
      const svm = getSvm();
      const [rootAuthority, sessionKeypair] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519Session authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(
          rootAuthority.publicKey,
          100n,
        ),
        id: swigId,
        payer: rootAuthority.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, rootAuthority);

      let swig = fetchSwig(svm, swigAddress);
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const rootRole = swig.roles[0];

      // Fund swig wallet
      svm.airdrop(walletAddress, SOL);

      // Create session
      const sessionIx = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        sessionKeypair.publicKey,
        50n,
      );
      sendSwigSVMTransaction(svm, sessionIx, rootAuthority);

      // Refresh swig to get updated roles
      swig = fetchSwig(svm, swigAddress);
      const sessionRole = swig.findRoleBySessionKey(sessionKeypair.publicKey)!;

      // Session key signs transfer
      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: SOL / 10n,
      });

      const signIx = await getSignInstructionContext(
        swig,
        sessionRole.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: sessionKeypair.publicKey },
      );
      sendSwigSVMTransaction(svm, signIx, sessionKeypair);

      expect(svm.getBalance(recipient.publicKey)).toBe(SOL / 10n);
    });

    test('can create multiple sessions', async () => {
      const svm = getSvm();
      const [rootAuthority, session1, session2] = getFundedKeys(svm, 3);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519Session authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(
          rootAuthority.publicKey,
          100n,
        ),
        id: swigId,
        payer: rootAuthority.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, rootAuthority);

      let swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Create first session
      const session1Ix = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        session1.publicKey,
        50n,
      );
      sendSwigSVMTransaction(svm, session1Ix, rootAuthority);

      // Refresh and create second session
      swig = fetchSwig(svm, swigAddress);
      const session2Ix = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        session2.publicKey,
        50n,
      );
      sendSwigSVMTransaction(svm, session2Ix, rootAuthority);

      // Verify both sessions exist
      swig = fetchSwig(svm, swigAddress);
      const sessionRole1 = swig.findRoleBySessionKey(session1.publicKey);
      const sessionRole2 = swig.findRoleBySessionKey(session2.publicKey);

      expect(sessionRole1).toBeDefined();
      expect(sessionRole2).toBeDefined();
    });
  });

  // ============================================================================
  // Secp256k1 Session Tests
  // ============================================================================

  describe('Secp256k1 session authority', () => {
    test('creates session with Secp256k1 session authority', async () => {
      const svm = getSvm();
      const [payer, sessionKeypair] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Secp256k1Session authority
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

      // Create session
      const sessionIx = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        sessionKeypair.publicKey,
        50n,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, sessionIx, payer);

      // Verify session was created
      swig = fetchSwig(svm, swigAddress);
      const sessionRole = swig.findRoleBySessionKey(sessionKeypair.publicKey);
      expect(sessionRole).toBeDefined();
    });

    test('secp256k1 session key can sign transactions', async () => {
      const svm = getSvm();
      const [payer, sessionKeypair] = getFundedKeys(svm, 2);
      const recipient = Keypair.generate();
      const swigId = randomBytes(32);
      const secpRoot = createTestSecp256k1SessionAuthority();

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Secp256k1Session authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: secpRoot.authorityInfo,
        id: swigId,
        payer: payer.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, payer);

      let swig = fetchSwig(svm, swigAddress);
      const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
      const rootRole = swig.roles[0];
      const slot = svm.getClock().slot;

      // Fund swig wallet
      svm.airdrop(walletAddress, SOL);

      // Create session
      const sessionIx = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        sessionKeypair.publicKey,
        50n,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn: secpRoot.signingFn!,
        },
      );
      sendSwigSVMTransaction(svm, sessionIx, payer);

      // Refresh swig
      swig = fetchSwig(svm, swigAddress);
      const sessionRole = swig.findRoleBySessionKey(sessionKeypair.publicKey)!;

      // Session key (ed25519) signs transfer
      const transfer = getTransferSolInstruction({
        source: address(walletAddress.toBase58()),
        destination: address(recipient.publicKey.toBase58()),
        amount: SOL / 10n,
      });

      const signIx = await getSignInstructionContext(
        swig,
        sessionRole.id,
        [transfer].map(SolInstruction.from),
        false,
        { payer: sessionKeypair.publicKey },
      );
      sendSwigSVMTransaction(svm, signIx, sessionKeypair);

      expect(svm.getBalance(recipient.publicKey)).toBe(SOL / 10n);
    });
  });

  // ============================================================================
  // Secp256r1 Session Tests
  // ============================================================================
  // Note: Secp256r1 session authority needs investigation
  // The secp256r1 instruction builder is missing the Instructions sysvar account

  // describe('Secp256r1 session authority', () => {
  //   test.skip('creates session with Secp256r1 session authority', async () => {
  //     // TODO: Investigate secp256r1 instruction sysvar account for createSession
  //   });
  //   test.skip('secp256r1 session key can sign transactions', async () => {
  //     // TODO: Investigate secp256r1 session key signing
  //   });
  // });

  // ============================================================================
  // Error Cases
  // ============================================================================

  describe('Error cases', () => {
    test('fails to create session for non-session authority', async () => {
      const svm = getSvm();
      const [root, sessionKeypair] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with regular Ed25519 authority (NOT session-based)
      const { createEd25519AuthorityInfo } = await import('../../src');
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519AuthorityInfo(root.publicKey),
        id: swigId,
        payer: root.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, root);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      // Attempt to create session should fail
      await expect(
        getCreateSessionInstructionContext(
          swig,
          rootRole.id,
          sessionKeypair.publicKey,
          50n,
        ),
      ).rejects.toThrow('Role is not a session-based');
    });
  });

  // ============================================================================
  // Instruction Structure Tests
  // ============================================================================

  describe('Instruction structure', () => {
    test('has correct account metas', async () => {
      const svm = getSvm();
      const [rootAuthority, sessionKeypair] = getFundedKeys(svm, 2);
      const swigId = randomBytes(32);

      const [swigAddress] = await findSwigPdaRaw(swigId);

      // Create swig with Ed25519Session authority
      const createIx = await getCreateSwigInstructionContext({
        authorityInfo: createEd25519SessionAuthorityInfo(
          rootAuthority.publicKey,
          100n,
        ),
        id: swigId,
        payer: rootAuthority.publicKey,
        actions: Actions.set().all().get(),
      });
      sendSwigSVMTransaction(svm, createIx, rootAuthority);

      const swig = fetchSwig(svm, swigAddress);
      const rootRole = swig.roles[0];

      const sessionIx = await getCreateSessionInstructionContext(
        swig,
        rootRole.id,
        sessionKeypair.publicKey,
        50n,
      );

      const instructions = sessionIx.getKitInstructions();
      expect(instructions.length).toBeGreaterThanOrEqual(1);

      const ix = instructions[0];
      expect(ix.accounts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
