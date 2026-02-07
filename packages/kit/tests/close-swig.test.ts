/**
 * Close Swig Tests - Kit Package - LiteSVM
 *
 * Tests the closeSwig instruction across all authority types using kit-style APIs:
 * - Ed25519 (token-based)
 * - Ed25519 Session
 * - Secp256k1 (token-based)
 * - Secp256k1 Session
 * - Secp256r1 (token-based)
 *
 * Each test:
 * 1. Creates a swig with a root authority
 * 2. Adds a second role with closeSwigAuthority permission (or uses root)
 * 3. Funds the wallet
 * 4. Drains excess SOL to rent-exempt minimum
 * 5. Closes the swig account and wallet PDA
 * 6. Verifies swig is resized to 1 byte with discriminator=255
 * 7. Verifies wallet PDA is closed
 * 8. Verifies destination received rent
 */

import { Wallet } from '@ethereumjs/wallet';
import { p256 } from '@noble/curves/nist';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  AddMultipleAuthoritiesInstructionBuilder,
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  createSecp256k1AuthorityInfo,
  createSecp256k1SessionAuthorityInfo,
  createSecp256r1AuthorityInfo,
  findSwigPda,
  getCloseSwigInstructions,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSigningFnForSecp256r1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import {
  addressToPublicKey,
  fetchSwig,
  generateTestKeypair,
  getFundedKeys,
  getSvm,
  LAMPORTS_PER_SOL_BIGINT,
} from './context';
import { randomBytes, sendKitTransaction, web3InstructionToKit } from './utils';

const SOL = LAMPORTS_PER_SOL_BIGINT;

/**
 * Verifies that a swig account has been properly closed:
 * - Swig account resized to 1 byte with discriminator=255
 * - Wallet PDA is closed (null or 0 lamports)
 * - Destination received rent from both accounts
 */
function verifyClosed(
  svm: ReturnType<typeof getSvm>,
  swigAddress: PublicKey,
  walletAddress: PublicKey,
  destinationKey: PublicKey,
  balanceBefore: bigint,
) {
  const swigAccountAfter = svm.getAccount(swigAddress);
  expect(swigAccountAfter).not.toBeNull();
  expect(swigAccountAfter!.data.length).toBe(1);
  expect(swigAccountAfter!.data[0]).toBe(255); // ClosedSwigAccount discriminator

  const walletPdaAfter = svm.getAccount(walletAddress);
  expect(
    walletPdaAfter === null || BigInt(walletPdaAfter.lamports) === 0n,
  ).toBe(true);

  const balanceAfter = svm.getBalance(destinationKey)!;
  expect(balanceAfter).toBeGreaterThan(balanceBefore);
}

describe('close-swig (kit)', () => {
  // ==========================================================================
  // Ed25519 (token-based)
  // ==========================================================================
  test('closes swig with Ed25519 authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [root, closer] = getFundedKeys(svm, 2);
    const destination = generateTestKeypair();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);
    const swigPk = addressToPublicKey(swigAddress);

    // Create swig with root + closer role (closeSwigAuthority)
    const createBuilder =
      AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction({
        payer: root.address,
        swigAddress,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo: createEd25519AuthorityInfo(root.address),
        options: {},
      });

    createBuilder.addAuthority(
      createEd25519AuthorityInfo(closer.address),
      Actions.set()
        .closeSwigAuthority()
        .solDestinationLimit({
          amount: 10n * SOL,
          destination: destination.publicKey,
        })
        .get(),
    );

    const createIxs = await createBuilder.getInstructions();
    sendKitTransaction(svm, createIxs, root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const walletPk = addressToPublicKey(walletAddress);

    // Fund wallet
    svm.airdrop(walletPk, SOL);

    // Drain excess SOL
    swig = fetchSwig(svm, swigAddress);
    const closerRole = swig.findRolesByEd25519SignerPk(closer.publicKey)[0]!;
    const excessSol = svm.getBalance(walletPk)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletPk,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(swig, closerRole.id, [
        web3InstructionToKit(drainIx),
      ]);
      sendKitTransaction(svm, drainSignIxs, closer);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletPk)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    const closeIxs = await getCloseSwigInstructions(swig, closerRole.id, {
      destination: destination.address,
    });
    sendKitTransaction(svm, closeIxs, closer);

    verifyClosed(svm, swigPk, walletPk, destination.publicKey, balanceBefore);
  });

  // ==========================================================================
  // Ed25519 Session
  // ==========================================================================
  test('closes swig with Ed25519 session authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [root, sessionKey] = getFundedKeys(svm, 2);
    const destination = generateTestKeypair();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);
    const swigPk = addressToPublicKey(swigAddress);

    // Create swig with root + session authority with closeSwigAuthority
    const createBuilder =
      AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction({
        payer: root.address,
        swigAddress,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo: createEd25519AuthorityInfo(root.address),
        options: {},
      });

    createBuilder.addAuthority(
      createEd25519SessionAuthorityInfo(root.address, 100n),
      Actions.set()
        .closeSwigAuthority()
        .solDestinationLimit({
          amount: 10n * SOL,
          destination: destination.publicKey,
        })
        .get(),
    );

    const createIxs = await createBuilder.getInstructions();
    sendKitTransaction(svm, createIxs, root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const walletPk = addressToPublicKey(walletAddress);

    // Fund wallet
    svm.airdrop(walletPk, SOL);

    // Create session
    const sessionRole = swig.findRoleById(1)!;
    expect(sessionRole.isSessionBased()).toBe(true);

    const sessionIx = await getCreateSessionInstructions(
      swig,
      sessionRole.id,
      sessionKey.address,
      50n,
    );
    sendKitTransaction(svm, sessionIx, root);

    swig = fetchSwig(svm, swigAddress);
    const activeSessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(activeSessionRole).toBeTruthy();

    // Drain excess SOL using session key
    const excessSol = svm.getBalance(walletPk)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletPk,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        activeSessionRole!.id,
        [web3InstructionToKit(drainIx)],
        false,
        { payer: sessionKey.address },
      );
      sendKitTransaction(svm, drainSignIxs, sessionKey);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletPk)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig using session key
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      activeSessionRole!.id,
      { destination: destination.address },
      { payer: sessionKey.address },
    );
    sendKitTransaction(svm, closeIxs, sessionKey);

    verifyClosed(svm, swigPk, walletPk, destination.publicKey, balanceBefore);
  });

  // ==========================================================================
  // Secp256k1 (token-based)
  // ==========================================================================
  test('closes swig with Secp256k1 authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [payer] = getFundedKeys(svm, 1);
    const ethWallet = Wallet.generate();
    const destination = generateTestKeypair();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);
    const swigPk = addressToPublicKey(swigAddress);

    // Create swig with secp256k1 authority (root, all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(ethWallet.getPublicKey()),
      id: swigId,
      payer: payer.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const walletPk = addressToPublicKey(walletAddress);
    const role = swig.findRolesBySecp256k1SignerAddress(
      ethWallet.getAddress(),
    )[0]!;
    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(walletPk, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      ethWallet.getPrivateKey(),
    );

    // Drain excess SOL
    swig = fetchSwig(svm, swigAddress);
    const excessSol = svm.getBalance(walletPk)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletPk,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        role.id,
        [web3InstructionToKit(drainIx)],
        false,
        {
          payer: payer.address,
          currentSlot: slot,
          signingFn,
        },
      );
      sendKitTransaction(svm, drainSignIxs, payer);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletPk)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      role.id,
      { destination: destination.address },
      {
        payer: payer.address,
        currentSlot: slot,
        signingFn,
      },
    );
    sendKitTransaction(svm, closeIxs, payer);

    verifyClosed(svm, swigPk, walletPk, destination.publicKey, balanceBefore);
  });

  // ==========================================================================
  // Secp256k1 Session
  // ==========================================================================
  test('closes swig with Secp256k1 session authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [payer, sessionKey] = getFundedKeys(svm, 2);
    const ethWallet = Wallet.generate();
    const destination = generateTestKeypair();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);
    const swigPk = addressToPublicKey(swigAddress);

    // Create swig with secp256k1 session authority (root, all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1SessionAuthorityInfo(
        ethWallet.getPublicKey(),
        100n,
      ),
      id: swigId,
      payer: payer.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const walletPk = addressToPublicKey(walletAddress);
    const rootRole = swig.findRoleById(0)!;
    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(walletPk, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      ethWallet.getPrivateKey(),
    );

    // Create session
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.address,
      50n,
      { currentSlot: slot, signingFn, payer: payer.address },
    );
    sendKitTransaction(svm, sessionIx, payer);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();

    // Drain excess SOL using session key
    const excessSol = svm.getBalance(walletPk)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletPk,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        sessionRole!.id,
        [web3InstructionToKit(drainIx)],
        false,
        { payer: sessionKey.address },
      );
      sendKitTransaction(svm, drainSignIxs, sessionKey);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletPk)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig using session key
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      sessionRole!.id,
      { destination: destination.address },
      { payer: sessionKey.address },
    );
    sendKitTransaction(svm, closeIxs, sessionKey);

    verifyClosed(svm, swigPk, walletPk, destination.publicKey, balanceBefore);
  });

  // ==========================================================================
  // Secp256r1 (token-based)
  // ==========================================================================
  test('closes swig with Secp256r1 (P256) authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [payer] = getFundedKeys(svm, 1);
    const r1 = p256.utils.randomPrivateKey();
    const r1PublicKey = p256.getPublicKey(r1);
    const destination = generateTestKeypair();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);
    const swigPk = addressToPublicKey(swigAddress);

    // Create swig with secp256r1 authority (root, all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256r1AuthorityInfo(r1PublicKey),
      id: swigId,
      payer: payer.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const walletPk = addressToPublicKey(walletAddress);

    // Find role by compressed public key
    const r1CompressedPub = p256.getPublicKey(r1, true);
    const role = swig.findRolesByAuthoritySigner(r1CompressedPub)[0]!;
    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(walletPk, SOL);
    swig = fetchSwig(svm, swigAddress);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256r1PrivateKey(r1);

    // Drain excess SOL
    const excessSol = svm.getBalance(walletPk)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletPk,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        role.id,
        [web3InstructionToKit(drainIx)],
        false,
        {
          payer: payer.address,
          currentSlot: slot,
          signingFn,
        },
      );
      sendKitTransaction(svm, drainSignIxs, payer);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletPk)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      role.id,
      { destination: destination.address },
      {
        payer: payer.address,
        currentSlot: slot,
        signingFn,
      },
    );
    sendKitTransaction(svm, closeIxs, payer);

    verifyClosed(svm, swigPk, walletPk, destination.publicKey, balanceBefore);
  });
});
