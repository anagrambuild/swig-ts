/**
 * Close Swig Tests - LiteSVM
 *
 * Tests the closeSwig instruction across all authority types:
 * - Ed25519 (token-based)
 * - Ed25519 Session
 * - Secp256k1 (token-based)
 * - Secp256k1 Session
 * - Secp256r1 (token-based)
 *
 * Each test:
 * 1. Creates a swig with the authority type under test (root/all permissions)
 * 2. Funds the wallet
 * 3. Drains excess SOL to rent-exempt minimum
 * 4. Closes the swig account and wallet PDA
 * 5. Verifies swig is resized to 1 byte with discriminator=255
 * 6. Verifies wallet PDA is closed
 * 7. Verifies destination received rent
 */

import { Wallet } from '@ethereumjs/wallet';
import { p256 } from '@noble/curves/nist';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
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
  SWIG_PROGRAM_ADDRESS,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);

/**
 * Derives the swig wallet address PDA.
 * seeds = ["swig-wallet-address", swigAccountAddress]
 */
function deriveWalletAddress(swigAddress: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('swig-wallet-address'), swigAddress.toBuffer()],
    SWIG_PROGRAM_ADDRESS,
  )[0];
}

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

describe('close-swig', () => {
  // ==========================================================================
  // Ed25519 (token-based)
  // ==========================================================================
  test('closes swig with Ed25519 authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [owner] = getFundedKeys(svm, 1);
    const destination = Keypair.generate();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);
    const walletAddressPda = deriveWalletAddress(swigAddress);

    // Create swig with ed25519 authority (all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(owner.publicKey),
      id: swigId,
      payer: owner.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], owner);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    expect(walletAddress.toBase58()).toBe(walletAddressPda.toBase58());

    const role = swig.findRolesByEd25519SignerPk(owner.publicKey)[0]!;
    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    // Drain excess SOL to rent-exempt minimum
    swig = fetchSwig(svm, swigAddress);
    const excessSol = svm.getBalance(walletAddress)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(swig, role.id, [drainIx]);
      sendSVMTransaction(svm, drainSignIxs, owner);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletAddress)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    const closeIxs = await getCloseSwigInstructions(swig, role.id, {
      destination: destination.publicKey,
    });
    sendSVMTransaction(svm, closeIxs, owner);

    verifyClosed(
      svm,
      swigAddress,
      walletAddress,
      destination.publicKey,
      balanceBefore,
    );
  });

  // ==========================================================================
  // Ed25519 Session
  // ==========================================================================
  test('closes swig with Ed25519 session authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [root, sessionKey] = getFundedKeys(svm, 2);
    const destination = Keypair.generate();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with ed25519 session authority (all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519SessionAuthorityInfo(root.publicKey, 100n),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;
    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    // Create session
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.publicKey,
      50n,
    );
    sendSVMTransaction(svm, sessionIx, root);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();

    // Drain excess SOL using session key
    const excessSol = svm.getBalance(walletAddress)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        sessionRole!.id,
        [drainIx],
        false,
        { payer: sessionKey.publicKey },
      );
      sendSVMTransaction(svm, drainSignIxs, sessionKey);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletAddress)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig using session key
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      sessionRole!.id,
      { destination: destination.publicKey },
      { payer: sessionKey.publicKey },
    );
    sendSVMTransaction(svm, closeIxs, sessionKey);

    verifyClosed(
      svm,
      swigAddress,
      walletAddress,
      destination.publicKey,
      balanceBefore,
    );
  });

  // ==========================================================================
  // Secp256k1 (token-based)
  // ==========================================================================
  test('closes swig with Secp256k1 authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [payer] = getFundedKeys(svm, 1);
    const ethWallet = Wallet.generate();
    const destination = Keypair.generate();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256k1 authority (all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1AuthorityInfo(ethWallet.getPublicKey()),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const role = swig.findRolesBySecp256k1SignerAddress(
      ethWallet.getAddress(),
    )[0]!;
    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      ethWallet.getPrivateKey(),
    );

    // Drain excess SOL
    swig = fetchSwig(svm, swigAddress);
    const excessSol = svm.getBalance(walletAddress)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        role.id,
        [drainIx],
        false,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn,
        },
      );
      sendSVMTransaction(svm, drainSignIxs, payer);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletAddress)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      role.id,
      { destination: destination.publicKey },
      {
        payer: payer.publicKey,
        currentSlot: slot,
        signingFn,
      },
    );
    sendSVMTransaction(svm, closeIxs, payer);

    verifyClosed(
      svm,
      swigAddress,
      walletAddress,
      destination.publicKey,
      balanceBefore,
    );
  });

  // ==========================================================================
  // Secp256k1 Session
  // ==========================================================================
  test('closes swig with Secp256k1 session authority', async () => {
    const svm = getSvm();
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);
    const [payer, sessionKey] = getFundedKeys(svm, 2);
    const ethWallet = Wallet.generate();
    const destination = Keypair.generate();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256k1 session authority (all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256k1SessionAuthorityInfo(
        ethWallet.getPublicKey(),
        100n,
      ),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);
    const rootRole = swig.findRoleById(0)!;
    expect(rootRole.isSessionBased()).toBe(true);

    // Fund wallet
    svm.airdrop(walletAddress, SOL);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256k1PrivateKey(
      ethWallet.getPrivateKey(),
    );

    // Create session (requires Ethereum signature)
    const sessionIx = await getCreateSessionInstructions(
      swig,
      rootRole.id,
      sessionKey.publicKey,
      50n,
      { currentSlot: slot, signingFn, payer: payer.publicKey },
    );
    sendSVMTransaction(svm, sessionIx, payer);

    swig = fetchSwig(svm, swigAddress);
    const sessionRole = swig.findRoleBySessionKey(sessionKey.publicKey);
    expect(sessionRole).toBeTruthy();

    // Drain excess SOL using session key
    const excessSol = svm.getBalance(walletAddress)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        sessionRole!.id,
        [drainIx],
        false,
        { payer: sessionKey.publicKey },
      );
      sendSVMTransaction(svm, drainSignIxs, sessionKey);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletAddress)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig using session key
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      sessionRole!.id,
      { destination: destination.publicKey },
      { payer: sessionKey.publicKey },
    );
    sendSVMTransaction(svm, closeIxs, sessionKey);

    verifyClosed(
      svm,
      swigAddress,
      walletAddress,
      destination.publicKey,
      balanceBefore,
    );
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
    const destination = Keypair.generate();
    svm.airdrop(destination.publicKey, SOL);

    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Create swig with secp256r1 authority (all permissions)
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createSecp256r1AuthorityInfo(r1PublicKey),
      id: swigId,
      payer: payer.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSVMTransaction(svm, [createIx], payer);

    let swig = fetchSwig(svm, swigAddress);
    const walletAddress = await getSwigWalletAddress(swig);

    // Find role by compressed public key
    const r1CompressedPub = p256.getPublicKey(r1, true);
    const role = swig.findRolesByAuthoritySigner(r1CompressedPub)[0]!;
    expect(role).toBeDefined();

    // Fund wallet
    svm.airdrop(walletAddress, SOL);
    swig = fetchSwig(svm, swigAddress);

    const slot = svm.getClock().slot;
    const signingFn = getSigningFnForSecp256r1PrivateKey(r1);

    // Drain excess SOL
    const excessSol = svm.getBalance(walletAddress)! - RENT_EXEMPT_MINIMUM;
    if (excessSol > 0n) {
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: destination.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(
        swig,
        role.id,
        [drainIx],
        false,
        {
          payer: payer.publicKey,
          currentSlot: slot,
          signingFn,
        },
      );
      sendSVMTransaction(svm, drainSignIxs, payer);
      swig = fetchSwig(svm, swigAddress);
    }

    expect(svm.getBalance(walletAddress)).toBe(RENT_EXEMPT_MINIMUM);

    // Close swig
    const balanceBefore = svm.getBalance(destination.publicKey)!;
    swig = fetchSwig(svm, swigAddress);
    const closeIxs = await getCloseSwigInstructions(
      swig,
      role.id,
      { destination: destination.publicKey },
      {
        payer: payer.publicKey,
        currentSlot: slot,
        signingFn,
      },
    );
    sendSVMTransaction(svm, closeIxs, payer);

    verifyClosed(
      svm,
      swigAddress,
      walletAddress,
      destination.publicKey,
      balanceBefore,
    );
  });
});
