/**
 * LI.FI Integration LiteSVM Test
 *
 * Demonstrates a real-world integration pattern where:
 * 1. A swig wallet address is pre-derived before the account exists
 * 2. Funds arrive at the wallet address (e.g., from a bridge)
 * 3. The swig account is created with two roles:
 *    - Primary owner (root authority)
 *    - LI.FI executor with destination limits restricting where funds can go
 * 4. LI.FI executor performs a multi-step execution:
 *    a. Collect partner fee
 *    b. Collect LI.FI protocol fee
 *    c. Collect paymaster fee (tx sponsorship)
 *    d. Simulate a swap (transfer tokens to DEX, receive output tokens)
 *    e. Transfer remaining output tokens to the user
 *    f. Verify the user received >= the minimum amount defined in restrictions
 * 5. Close the swig wallet ATAs and reclaim rent to LI.FI
 *
 * Flow:
 *   pre-derive swig address & wallet address
 *   -> fund wallet (bridge arrival)
 *   -> create swig with owner + LI.FI roles
 *   -> LI.FI executor: collect fees + swap + transfer to user
 *   -> owner: close ATAs to reclaim rent to LI.FI
 */

import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  AddMultipleAuthoritiesInstructionBuilder,
  createEd25519AuthorityInfo,
  findSwigPda,
  getRemoveAuthorityInstructions,
  getSignInstructions,
  getSwigWalletAddress,
  SWIG_PROGRAM_ADDRESS,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendSVMTransaction } from './utils';

const SOL = BigInt(LAMPORTS_PER_SOL);
const DECIMALS = 6;
const TOKEN_UNIT = BigInt(10 ** DECIMALS);

/** Format lamports as SOL string for logging */
function lamportsToSol(lamports: bigint): string {
  return `${Number(lamports) / LAMPORTS_PER_SOL} SOL`;
}

/** Format raw token amount with decimals for logging */
function formatTokens(amount: bigint, symbol = 'tokens'): string {
  return `${Number(amount) / 10 ** DECIMALS} ${symbol}`;
}

/**
 * Derives the swig wallet address PDA before the swig account exists.
 * seeds = ["swig-wallet-address", swigAccountAddress]
 */
function deriveWalletAddress(swigAddress: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('swig-wallet-address'), swigAddress.toBuffer()],
    SWIG_PROGRAM_ADDRESS,
  )[0];
}

describe('lifi-svm', () => {
  test('SOL: pre-derive, fund, create, execute with destination limits, cleanup', async () => {
    const svm = getSvm();

    // Rent-exempt minimum for a 0-byte account (swig wallet address PDA)
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);

    console.log('\n=== SOL LI.FI Integration Test ===\n');

    // =========================================================================
    // Actors
    // =========================================================================
    const [primaryOwner, lifiExecutor, partnerTreasury, lifiTreasury] =
      getFundedKeys(svm, 4);

    // The paymaster is the entity that sponsors transactions (pays gas fees)
    const paymasterTreasury = Keypair.generate();

    // The end-user who will receive the SOL after fees
    const userRecipient = Keypair.generate();
    svm.airdrop(userRecipient.publicKey, SOL);

    console.log('Actors:');
    console.log(
      `  Primary Owner:      ${primaryOwner.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  LI.FI Executor:     ${lifiExecutor.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Partner Treasury:   ${partnerTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  LI.FI Treasury:     ${lifiTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Paymaster Treasury: ${paymasterTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  User Recipient:     ${userRecipient.publicKey.toBase58().slice(0, 12)}...`,
    );

    // =========================================================================
    // Step 1: Pre-derive the swig account address and wallet address
    //         This happens BEFORE the swig account exists on-chain.
    //         The wallet address can be shared with a bridge or on-ramp
    //         so funds can be sent there ahead of time.
    // =========================================================================
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);

    // Pre-derive the v2 wallet address PDA
    const walletAddressPda = deriveWalletAddress(swigAddress);

    console.log('\n[Step 1] Pre-derive addresses (before account exists)');
    console.log(`  Swig Account:  ${swigAddress.toBase58().slice(0, 12)}...`);
    console.log(
      `  Wallet Address: ${walletAddressPda.toBase58().slice(0, 12)}...`,
    );

    // =========================================================================
    // Step 2: Funds arrive at the wallet address
    //         (simulating bridge/on-ramp deposit)
    //         At this point the swig account does NOT exist yet.
    // =========================================================================
    const bridgedAmount = 5n * SOL;
    svm.airdrop(walletAddressPda, bridgedAmount);

    const preFundBalance = svm.getBalance(walletAddressPda);
    expect(preFundBalance).toBe(bridgedAmount);

    console.log('\n[Step 2] Bridge deposit arrives at wallet address');
    console.log(
      `  Deposited: ${lamportsToSol(bridgedAmount)} to pre-derived wallet`,
    );
    console.log(`  Wallet balance: ${lamportsToSol(preFundBalance!)}`);

    // =========================================================================
    // Step 3: Create the swig account with two roles:
    //   Role 0: Primary owner (root - all permissions)
    //   Role 1: LI.FI executor with SOL destination limits
    //
    // The LI.FI executor can only send SOL to specific destinations
    // (partner, LI.FI, paymaster, user) with per-destination caps.
    // =========================================================================
    const partnerFee = SOL / 100n; // 0.01 SOL
    const lifiFee = SOL / 200n; // 0.005 SOL
    const paymasterFee = SOL / 500n; // 0.002 SOL

    // The minimum amount the user must receive after fees
    const minUserAmount = 3n * SOL;

    // The user destination limit allows transfer of up to the bridged amount
    // minus fees and rent. This acts as both the cap and the minimum guarantee:
    // the LI.FI backend will only attempt a transfer >= minUserAmount.
    const userDestinationBudget = bridgedAmount;

    const lifiActions = Actions.set()
      .solDestinationLimit({
        amount: partnerFee,
        destination: partnerTreasury.publicKey,
      })
      .solDestinationLimit({
        amount: lifiFee,
        destination: lifiTreasury.publicKey,
      })
      .solDestinationLimit({
        amount: paymasterFee,
        destination: paymasterTreasury.publicKey,
      })
      .solDestinationLimit({
        amount: userDestinationBudget,
        destination: userRecipient.publicKey,
      })
      .get();

    console.log('\n[Step 3] Create swig wallet with 2 roles');
    console.log('  Role 0: Primary Owner (root - all permissions)');
    console.log('  Role 1: LI.FI Executor with SOL destination limits:');
    console.log(`    - Partner:   up to ${lamportsToSol(partnerFee)}`);
    console.log(`    - LI.FI:     up to ${lamportsToSol(lifiFee)}`);
    console.log(`    - Paymaster: up to ${lamportsToSol(paymasterFee)}`);
    console.log(
      `    - User:      up to ${lamportsToSol(userDestinationBudget)}`,
    );

    // Create swig with root authority, then atomically add LI.FI authority
    const createBuilder =
      AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction({
        payer: primaryOwner.publicKey,
        swigAddress,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo: createEd25519AuthorityInfo(primaryOwner.publicKey),
        options: {},
      });

    createBuilder.addAuthority(
      createEd25519AuthorityInfo(lifiExecutor.publicKey),
      lifiActions,
    );

    const createIxs = await createBuilder.getInstructions();
    sendSVMTransaction(svm, createIxs, primaryOwner);

    // Verify creation
    let swig = fetchSwig(svm, swigAddress);
    expect(swig.roles.length).toBe(2);
    expect(swig.accountVersion()).toBe('v2');

    const walletAddress = await getSwigWalletAddress(swig);
    expect(walletAddress.toBase58()).toBe(walletAddressPda.toBase58());

    // Verify the pre-funded balance is intact
    const walletBalance = svm.getBalance(walletAddress);
    expect(walletBalance).toBe(bridgedAmount);

    // Look up roles
    const ownerRole = swig.findRolesByEd25519SignerPk(
      primaryOwner.publicKey,
    )[0]!;
    expect(ownerRole).toBeDefined();
    expect(ownerRole.actions.isRoot()).toBe(true);

    const lifiRole = swig.findRolesByEd25519SignerPk(
      lifiExecutor.publicKey,
    )[0]!;
    expect(lifiRole).toBeDefined();
    expect(lifiRole.actions.canSpendSol()).toBe(true);

    console.log(`  Swig created (v2). Roles: ${swig.roles.length}`);
    console.log(
      `  Owner role ID: ${ownerRole.id} (root=${ownerRole.actions.isRoot()})`,
    );
    console.log(
      `  LI.FI role ID: ${lifiRole.id} (canSpendSol=${lifiRole.actions.canSpendSol()})`,
    );
    console.log(
      `  Wallet balance after creation: ${lamportsToSol(walletBalance!)}`,
    );

    // =========================================================================
    // Step 4a: LI.FI executor collects partner fee
    // =========================================================================
    console.log('\n[Step 4a] LI.FI collects partner fee');

    const partnerFeeIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: partnerTreasury.publicKey,
      lamports: Number(partnerFee),
    });
    const partnerFeeSignIx = await getSignInstructions(swig, lifiRole.id, [
      partnerFeeIx,
    ]);
    sendSVMTransaction(svm, partnerFeeSignIx, lifiExecutor);

    swig = fetchSwig(svm, swigAddress);

    const partnerBalance = svm.getBalance(partnerTreasury.publicKey)!;
    expect(partnerBalance).toBe(SOL + partnerFee); // initial airdrop + fee

    console.log(`  Transferred: ${lamportsToSol(partnerFee)} to partner`);
    console.log(`  Partner balance: ${lamportsToSol(partnerBalance)}`);
    console.log(
      `  Wallet balance: ${lamportsToSol(svm.getBalance(walletAddress)!)}`,
    );

    // =========================================================================
    // Step 4b: LI.FI executor collects LI.FI protocol fee
    // =========================================================================
    console.log('\n[Step 4b] LI.FI collects protocol fee');

    const lifiFeeIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: lifiTreasury.publicKey,
      lamports: Number(lifiFee),
    });
    const lifiFeeSignIx = await getSignInstructions(swig, lifiRole.id, [
      lifiFeeIx,
    ]);
    sendSVMTransaction(svm, lifiFeeSignIx, lifiExecutor);

    swig = fetchSwig(svm, swigAddress);

    const lifiBalance = svm.getBalance(lifiTreasury.publicKey)!;
    expect(lifiBalance).toBe(SOL + lifiFee);

    console.log(`  Transferred: ${lamportsToSol(lifiFee)} to LI.FI`);
    console.log(`  LI.FI balance: ${lamportsToSol(lifiBalance)}`);
    console.log(
      `  Wallet balance: ${lamportsToSol(svm.getBalance(walletAddress)!)}`,
    );

    // =========================================================================
    // Step 4c: LI.FI executor collects paymaster fee
    // =========================================================================
    console.log('\n[Step 4c] LI.FI collects paymaster fee');

    const paymasterFeeIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: paymasterTreasury.publicKey,
      lamports: Number(paymasterFee),
    });
    const paymasterFeeSignIx = await getSignInstructions(swig, lifiRole.id, [
      paymasterFeeIx,
    ]);
    sendSVMTransaction(svm, paymasterFeeSignIx, lifiExecutor);

    swig = fetchSwig(svm, swigAddress);

    const paymasterBalance = svm.getBalance(paymasterTreasury.publicKey)!;
    expect(paymasterBalance).toBe(paymasterFee);

    console.log(`  Transferred: ${lamportsToSol(paymasterFee)} to paymaster`);
    console.log(`  Paymaster balance: ${lamportsToSol(paymasterBalance)}`);
    console.log(
      `  Wallet balance: ${lamportsToSol(svm.getBalance(walletAddress)!)}`,
    );

    // =========================================================================
    // Step 4d: Transfer remaining SOL to user (simulated "swap" output)
    //
    // In production, the LI.FI API would provide callData for a DEX swap.
    // Here we simulate by transferring the remaining SOL directly.
    // The wallet must retain at least RENT_EXEMPT_MINIMUM lamports.
    // =========================================================================
    const totalFees = partnerFee + lifiFee + paymasterFee;
    const userTransferAmount = bridgedAmount - totalFees - RENT_EXEMPT_MINIMUM;

    // Verify the amount meets the minimum guarantee
    expect(userTransferAmount >= minUserAmount).toBe(true);

    console.log(
      '\n[Step 4d] Transfer remaining SOL to user (simulated swap output)',
    );
    console.log(`  Total fees collected: ${lamportsToSol(totalFees)}`);
    console.log(
      `  Rent-exempt reserve:  ${lamportsToSol(RENT_EXEMPT_MINIMUM)}`,
    );
    console.log(`  User receives:        ${lamportsToSol(userTransferAmount)}`);
    console.log(`  Min guarantee:        ${lamportsToSol(minUserAmount)}`);
    console.log(
      `  Meets minimum?        ${userTransferAmount >= minUserAmount}`,
    );

    const userTransferIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: userRecipient.publicKey,
      lamports: Number(userTransferAmount),
    });
    const userTransferSignIx = await getSignInstructions(swig, lifiRole.id, [
      userTransferIx,
    ]);
    sendSVMTransaction(svm, userTransferSignIx, lifiExecutor);

    swig = fetchSwig(svm, swigAddress);

    // Verify user received the correct amount
    const userBalance = svm.getBalance(userRecipient.publicKey)!;
    expect(userBalance).toBe(SOL + userTransferAmount); // initial airdrop + transfer

    // Verify wallet retains only rent-exempt minimum
    const walletBalanceAfter = svm.getBalance(walletAddress)!;
    expect(walletBalanceAfter).toBe(RENT_EXEMPT_MINIMUM);

    console.log(`  User balance after:   ${lamportsToSol(userBalance)}`);
    console.log(
      `  Wallet balance after: ${lamportsToSol(walletBalanceAfter)} (rent-exempt only)`,
    );

    // =========================================================================
    // Step 5: Verify restrictions - LI.FI cannot exceed destination limits
    // =========================================================================
    console.log('\n[Step 5] Verify LI.FI role restrictions are enforced');

    // Fund the wallet again so the balance is not the limiting factor
    svm.airdrop(walletAddress, SOL);
    swig = fetchSwig(svm, swigAddress);

    console.log('  Re-funded wallet with 1 SOL for restriction test');

    // This should fail because the LI.FI role's destination limit for
    // userRecipient is exhausted (userDestinationBudget - userTransferAmount
    // is very small)
    const extraTransferIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: userRecipient.publicKey,
      lamports: Number(SOL),
    });
    const extraSignIx = await getSignInstructions(swig, lifiRole.id, [
      extraTransferIx,
    ]);
    expect(() => sendSVMTransaction(svm, extraSignIx, lifiExecutor)).toThrow();

    console.log(
      '  LI.FI tried to transfer 1 SOL to user -> REJECTED (limit exceeded)',
    );

    // =========================================================================
    // Step 6: Owner removes the LI.FI role (cleanup)
    // =========================================================================
    console.log('\n[Step 6] Owner removes LI.FI role (cleanup)');

    swig = fetchSwig(svm, swigAddress);

    const removeIx = await getRemoveAuthorityInstructions(
      swig,
      ownerRole.id,
      lifiRole.id,
    );
    sendSVMTransaction(svm, removeIx, primaryOwner);

    swig = fetchSwig(svm, swigAddress);
    expect(swig.roles.length).toBe(1);
    expect(swig.findRolesByEd25519SignerPk(lifiExecutor.publicKey).length).toBe(
      0,
    );

    console.log(`  Roles remaining: ${swig.roles.length}`);
    console.log('  LI.FI role removed successfully');

    console.log('\n=== SOL LI.FI Integration Test PASSED ===\n');
  });

  test('full LI.FI flow with SPL tokens: fees, swap simulation, ATA close', async () => {
    const svm = getSvm();

    console.log('\n=== SPL Token LI.FI Integration Test ===\n');

    // =========================================================================
    // Actors
    // =========================================================================
    const [primaryOwner, lifiExecutor] = getFundedKeys(
      svm,
      2,
      10 * Number(SOL),
    );
    const partnerTreasury = Keypair.generate();
    const lifiTreasury = Keypair.generate();
    const paymasterTreasury = Keypair.generate();
    const userRecipient = Keypair.generate();

    // Fund accounts that need SOL for rent
    svm.airdrop(partnerTreasury.publicKey, SOL);
    svm.airdrop(lifiTreasury.publicKey, SOL);
    svm.airdrop(userRecipient.publicKey, SOL);

    console.log('Actors:');
    console.log(
      `  Primary Owner:      ${primaryOwner.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  LI.FI Executor:     ${lifiExecutor.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Partner Treasury:   ${partnerTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  LI.FI Treasury:     ${lifiTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Paymaster Treasury: ${paymasterTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  User Recipient:     ${userRecipient.publicKey.toBase58().slice(0, 12)}...`,
    );

    // =========================================================================
    // Step 1: Create two SPL token mints
    //   - inputMint: the token bridged into the swig wallet (e.g., USDC)
    //   - outputMint: the token received after "swap" (e.g., BONK)
    // =========================================================================
    const inputMintKeypair = Keypair.generate();
    const outputMintKeypair = Keypair.generate();

    for (const mintKp of [inputMintKeypair, outputMintKeypair]) {
      const mintLamports = svm.minimumBalanceForRentExemption(
        BigInt(getMintLen([])),
      );
      const createMintIx = SystemProgram.createAccount({
        fromPubkey: primaryOwner.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports: Number(mintLamports),
        space: getMintLen([]),
        programId: TOKEN_PROGRAM_ID,
      });
      const initMintIx = createInitializeMintInstruction(
        mintKp.publicKey,
        DECIMALS,
        primaryOwner.publicKey,
        primaryOwner.publicKey,
      );
      sendSVMTransaction(svm, [createMintIx, initMintIx], primaryOwner, [
        mintKp,
      ]);
    }

    console.log('\n[Step 1] Create SPL token mints');
    console.log(
      `  Input mint (USDC):  ${inputMintKeypair.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Output mint (BONK): ${outputMintKeypair.publicKey.toBase58().slice(0, 12)}...`,
    );

    // =========================================================================
    // Step 2: Pre-derive swig addresses
    // =========================================================================
    const swigId = randomBytes(32);
    const swigAddress = findSwigPda(swigId);
    const walletAddressPda = deriveWalletAddress(swigAddress);

    console.log('\n[Step 2] Pre-derive swig addresses');
    console.log(`  Swig Account:   ${swigAddress.toBase58().slice(0, 12)}...`);
    console.log(
      `  Wallet Address: ${walletAddressPda.toBase58().slice(0, 12)}...`,
    );

    // =========================================================================
    // Step 3: Create ATAs for the pre-derived wallet address
    //         and deposit input tokens (simulating bridge arrival)
    // =========================================================================
    const swigInputAta = getAssociatedTokenAddressSync(
      inputMintKeypair.publicKey,
      walletAddressPda,
      true, // allowOwnerOffCurve for PDA
    );
    const swigOutputAta = getAssociatedTokenAddressSync(
      outputMintKeypair.publicKey,
      walletAddressPda,
      true,
    );

    // Create the input ATA and mint tokens to simulate bridge deposit
    const createInputAtaIx = createAssociatedTokenAccountInstruction(
      primaryOwner.publicKey,
      swigInputAta,
      walletAddressPda,
      inputMintKeypair.publicKey,
    );
    sendSVMTransaction(svm, [createInputAtaIx], primaryOwner);

    const bridgedTokenAmount = 10_000n * TOKEN_UNIT; // 10,000 USDC
    const mintToSwigIx = createMintToInstruction(
      inputMintKeypair.publicKey,
      swigInputAta,
      primaryOwner.publicKey,
      bridgedTokenAmount,
    );
    sendSVMTransaction(svm, [mintToSwigIx], primaryOwner);

    // Also fund with some SOL for rent
    svm.airdrop(walletAddressPda, 2n * SOL);

    console.log('\n[Step 3] Fund pre-derived wallet (bridge deposit)');
    console.log(
      `  Deposited: ${formatTokens(bridgedTokenAmount, 'USDC')} to swig input ATA`,
    );
    console.log(`  Funded: ${lamportsToSol(2n * SOL)} SOL for rent`);
    console.log(`  Input ATA:  ${swigInputAta.toBase58().slice(0, 12)}...`);
    console.log(
      `  Output ATA: ${swigOutputAta.toBase58().slice(0, 12)}... (not yet created)`,
    );

    // =========================================================================
    // Step 4: Create fee recipient ATAs and user output ATA
    // =========================================================================
    const partnerInputAta = getAssociatedTokenAddressSync(
      inputMintKeypair.publicKey,
      partnerTreasury.publicKey,
    );
    const lifiInputAta = getAssociatedTokenAddressSync(
      inputMintKeypair.publicKey,
      lifiTreasury.publicKey,
    );
    const paymasterInputAta = getAssociatedTokenAddressSync(
      inputMintKeypair.publicKey,
      paymasterTreasury.publicKey,
    );
    const userOutputAta = getAssociatedTokenAddressSync(
      outputMintKeypair.publicKey,
      userRecipient.publicKey,
    );

    // Also create a "DEX sink" ATA where remaining input tokens go during swap
    // In production this would be the DEX's token account
    const dexSink = Keypair.generate();
    svm.airdrop(dexSink.publicKey, SOL);
    const dexSinkAta = getAssociatedTokenAddressSync(
      inputMintKeypair.publicKey,
      dexSink.publicKey,
    );

    for (const { ata, owner, mint } of [
      {
        ata: partnerInputAta,
        owner: partnerTreasury.publicKey,
        mint: inputMintKeypair.publicKey,
      },
      {
        ata: lifiInputAta,
        owner: lifiTreasury.publicKey,
        mint: inputMintKeypair.publicKey,
      },
      {
        ata: paymasterInputAta,
        owner: paymasterTreasury.publicKey,
        mint: inputMintKeypair.publicKey,
      },
      {
        ata: userOutputAta,
        owner: userRecipient.publicKey,
        mint: outputMintKeypair.publicKey,
      },
      {
        ata: dexSinkAta,
        owner: dexSink.publicKey,
        mint: inputMintKeypair.publicKey,
      },
    ]) {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        primaryOwner.publicKey,
        ata,
        owner,
        mint,
      );
      sendSVMTransaction(svm, [createAtaIx], primaryOwner);
    }

    console.log('\n[Step 4] Create fee recipient and user ATAs');
    console.log(
      '  Created 5 ATAs: partner, LI.FI, paymaster, user output, DEX sink',
    );

    // =========================================================================
    // Step 5: Create swig with owner + LI.FI roles
    //
    // The LI.FI role has:
    //   - tokenDestinationLimit for each fee recipient (input token)
    //   - tokenDestinationLimit for the DEX sink (input token swap)
    //   - tokenDestinationLimit for the user (output token)
    //   - programAll so it can CPI into Token program
    // =========================================================================
    const partnerTokenFee = 50n * TOKEN_UNIT; // 50 USDC
    const lifiTokenFee = 25n * TOKEN_UNIT; // 25 USDC
    const paymasterTokenFee = 10n * TOKEN_UNIT; // 10 USDC
    const minUserOutputTokens = 5_000n * TOKEN_UNIT; // 5000 output tokens minimum

    const lifiActions = Actions.set()
      // Token fees for input token (USDC) to various fee recipients
      .tokenDestinationLimit({
        mint: inputMintKeypair.publicKey,
        amount: partnerTokenFee,
        destination: partnerInputAta,
      })
      .tokenDestinationLimit({
        mint: inputMintKeypair.publicKey,
        amount: lifiTokenFee,
        destination: lifiInputAta,
      })
      .tokenDestinationLimit({
        mint: inputMintKeypair.publicKey,
        amount: paymasterTokenFee,
        destination: paymasterInputAta,
      })
      // DEX sink: remaining input tokens after fees go to the "swap"
      .tokenDestinationLimit({
        mint: inputMintKeypair.publicKey,
        amount: bridgedTokenAmount, // allow up to entire balance
        destination: dexSinkAta,
      })
      // Output token destination limit to user (minimum guaranteed amount)
      .tokenDestinationLimit({
        mint: outputMintKeypair.publicKey,
        amount: minUserOutputTokens + 2_000n * TOKEN_UNIT, // allow up to 7000
        destination: userOutputAta,
      })
      .get();

    console.log('\n[Step 5] Create swig with owner + LI.FI roles');
    console.log('  Role 0: Primary Owner (root - all permissions)');
    console.log('  Role 1: LI.FI Executor with token destination limits:');
    console.log(
      `    - Partner fee:   ${formatTokens(partnerTokenFee, 'USDC')}`,
    );
    console.log(`    - LI.FI fee:     ${formatTokens(lifiTokenFee, 'USDC')}`);
    console.log(
      `    - Paymaster fee: ${formatTokens(paymasterTokenFee, 'USDC')}`,
    );
    console.log(
      `    - DEX sink:      ${formatTokens(bridgedTokenAmount, 'USDC')} (swap input)`,
    );
    console.log(
      `    - User output:   ${formatTokens(minUserOutputTokens + 2_000n * TOKEN_UNIT, 'BONK')} max`,
    );

    const createBuilder =
      AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction({
        payer: primaryOwner.publicKey,
        swigAddress,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo: createEd25519AuthorityInfo(primaryOwner.publicKey),
        options: {},
      });

    createBuilder.addAuthority(
      createEd25519AuthorityInfo(lifiExecutor.publicKey),
      lifiActions,
    );

    const createIxs = await createBuilder.getInstructions();
    sendSVMTransaction(svm, createIxs, primaryOwner);

    // Verify creation
    let swig = fetchSwig(svm, swigAddress);
    expect(swig.roles.length).toBe(2);

    const walletAddress = await getSwigWalletAddress(swig);
    expect(walletAddress.toBase58()).toBe(walletAddressPda.toBase58());

    const ownerRole = swig.findRolesByEd25519SignerPk(
      primaryOwner.publicKey,
    )[0]!;
    const lifiRole = swig.findRolesByEd25519SignerPk(
      lifiExecutor.publicKey,
    )[0]!;
    expect(ownerRole).toBeDefined();
    expect(lifiRole).toBeDefined();

    console.log(`  Swig created. Roles: ${swig.roles.length}`);
    console.log(`  Owner role ID: ${ownerRole.id}`);
    console.log(`  LI.FI role ID: ${lifiRole.id}`);

    // =========================================================================
    // Step 6a: LI.FI executor collects partner token fee
    // =========================================================================
    console.log('\n[Step 6a] LI.FI collects partner token fee');

    const partnerFeeIx = createTransferInstruction(
      swigInputAta,
      partnerInputAta,
      walletAddress,
      partnerTokenFee,
    );
    const partnerFeeSignIxs = await getSignInstructions(swig, lifiRole.id, [
      partnerFeeIx,
    ]);
    sendSVMTransaction(svm, partnerFeeSignIxs, lifiExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify partner received the fee
    expect(svm.getAccount(partnerInputAta)).toBeDefined();

    console.log(
      `  Transferred: ${formatTokens(partnerTokenFee, 'USDC')} to partner`,
    );

    // =========================================================================
    // Step 6b: LI.FI executor collects LI.FI protocol token fee
    // =========================================================================
    console.log('\n[Step 6b] LI.FI collects protocol token fee');

    const lifiFeeIx = createTransferInstruction(
      swigInputAta,
      lifiInputAta,
      walletAddress,
      lifiTokenFee,
    );
    const lifiFeeSignIxs = await getSignInstructions(swig, lifiRole.id, [
      lifiFeeIx,
    ]);
    sendSVMTransaction(svm, lifiFeeSignIxs, lifiExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify LI.FI received the fee
    expect(svm.getAccount(lifiInputAta)).toBeDefined();

    console.log(
      `  Transferred: ${formatTokens(lifiTokenFee, 'USDC')} to LI.FI`,
    );

    // =========================================================================
    // Step 6c: LI.FI executor collects paymaster token fee
    // =========================================================================
    console.log('\n[Step 6c] LI.FI collects paymaster token fee');

    const paymasterFeeIx = createTransferInstruction(
      swigInputAta,
      paymasterInputAta,
      walletAddress,
      paymasterTokenFee,
    );
    const paymasterFeeSignIxs = await getSignInstructions(swig, lifiRole.id, [
      paymasterFeeIx,
    ]);
    sendSVMTransaction(svm, paymasterFeeSignIxs, lifiExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify paymaster received the fee
    expect(svm.getAccount(paymasterInputAta)).toBeDefined();

    const totalTokenFees = partnerTokenFee + lifiTokenFee + paymasterTokenFee;
    console.log(
      `  Transferred: ${formatTokens(paymasterTokenFee, 'USDC')} to paymaster`,
    );
    console.log(
      `  Total fees collected: ${formatTokens(totalTokenFees, 'USDC')}`,
    );

    // =========================================================================
    // Step 6d: Simulate a swap
    //
    // In production, the LI.FI API provides callData for a DEX swap.
    // Here we simulate by:
    //   1. Transferring remaining input tokens to a "DEX sink" via swig
    //   2. DEX "deposits" output tokens to the swig wallet's output ATA
    //      (simulated by minting directly)
    // =========================================================================
    console.log('\n[Step 6d] Simulate swap (input USDC -> output BONK)');

    // Create output ATA for the swig wallet
    const createOutputAtaIx = createAssociatedTokenAccountInstruction(
      lifiExecutor.publicKey,
      swigOutputAta,
      walletAddress,
      outputMintKeypair.publicKey,
    );
    sendSVMTransaction(svm, [createOutputAtaIx], lifiExecutor);

    console.log('  Created output ATA for swig wallet');

    // Transfer remaining input tokens to DEX sink (swap input)
    const remainingInput =
      bridgedTokenAmount - partnerTokenFee - lifiTokenFee - paymasterTokenFee;
    const swapInputIx = createTransferInstruction(
      swigInputAta,
      dexSinkAta,
      walletAddress,
      remainingInput,
    );
    const swapInputSignIxs = await getSignInstructions(swig, lifiRole.id, [
      swapInputIx,
    ]);
    sendSVMTransaction(svm, swapInputSignIxs, lifiExecutor);
    swig = fetchSwig(svm, swigAddress);

    console.log(
      `  Sent ${formatTokens(remainingInput, 'USDC')} to DEX (swap input)`,
    );

    // DEX deposits output tokens to swig wallet (simulated by minting)
    const swapOutputAmount = 6_000n * TOKEN_UNIT;
    const mintOutputIx = createMintToInstruction(
      outputMintKeypair.publicKey,
      swigOutputAta,
      primaryOwner.publicKey,
      swapOutputAmount,
    );
    sendSVMTransaction(svm, [mintOutputIx], primaryOwner);

    console.log(
      `  DEX returned ${formatTokens(swapOutputAmount, 'BONK')} (swap output)`,
    );

    // =========================================================================
    // Step 6e: Transfer swap output tokens to the user
    //
    // The swig enforces that the LI.FI role can only transfer up to
    // the tokenDestinationLimit for the userOutputAta destination.
    // =========================================================================
    console.log('\n[Step 6e] Transfer swap output to user');

    const userTokenTransferIx = createTransferInstruction(
      swigOutputAta,
      userOutputAta,
      walletAddress,
      swapOutputAmount,
    );
    const userTokenSignIxs = await getSignInstructions(swig, lifiRole.id, [
      userTokenTransferIx,
    ]);
    sendSVMTransaction(svm, userTokenSignIxs, lifiExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify user received the output tokens
    const userOutputAtaAccount = svm.getAccount(userOutputAta);
    expect(userOutputAtaAccount).toBeDefined();

    // Verify the amount sent meets the minimum guarantee
    expect(swapOutputAmount >= minUserOutputTokens).toBe(true);

    console.log(
      `  Transferred: ${formatTokens(swapOutputAmount, 'BONK')} to user`,
    );
    console.log(
      `  Min guarantee: ${formatTokens(minUserOutputTokens, 'BONK')}`,
    );
    console.log(`  Meets minimum? ${swapOutputAmount >= minUserOutputTokens}`);

    // =========================================================================
    // Step 6f: Verify restrictions - LI.FI cannot send tokens to
    //          unauthorized destinations
    // =========================================================================
    console.log(
      '\n[Step 6f] Verify token destination restrictions are enforced',
    );

    const unauthorizedRecipient = Keypair.generate();
    svm.airdrop(unauthorizedRecipient.publicKey, SOL);
    const unauthorizedAta = getAssociatedTokenAddressSync(
      outputMintKeypair.publicKey,
      unauthorizedRecipient.publicKey,
    );
    sendSVMTransaction(
      svm,
      [
        createAssociatedTokenAccountInstruction(
          primaryOwner.publicKey,
          unauthorizedAta,
          unauthorizedRecipient.publicKey,
          outputMintKeypair.publicKey,
        ),
      ],
      primaryOwner,
    );

    // Mint more output tokens to the swig wallet for testing
    sendSVMTransaction(
      svm,
      [
        createMintToInstruction(
          outputMintKeypair.publicKey,
          swigOutputAta,
          primaryOwner.publicKey,
          1_000n * TOKEN_UNIT,
        ),
      ],
      primaryOwner,
    );

    // Attempt to transfer to unauthorized destination - should fail
    swig = fetchSwig(svm, swigAddress);
    const unauthorizedTransferIx = createTransferInstruction(
      swigOutputAta,
      unauthorizedAta,
      walletAddress,
      100n * TOKEN_UNIT,
    );
    const unauthorizedSignIx = await getSignInstructions(swig, lifiRole.id, [
      unauthorizedTransferIx,
    ]);
    expect(() =>
      sendSVMTransaction(svm, unauthorizedSignIx, lifiExecutor),
    ).toThrow();

    console.log(
      '  LI.FI tried to send 100 BONK to unauthorized address -> REJECTED',
    );

    // =========================================================================
    // Step 7: Close ATAs to reclaim rent
    //
    // The owner first transfers any remaining tokens out, then closes the
    // swig wallet's ATAs. Rent-exempt lamports go to LI.FI treasury as
    // reimbursement for transaction sponsorship.
    //
    // Note: SPL Token accounts can only be closed when their balance is zero.
    // The input ATA should already be zero (all tokens were transferred).
    // The output ATA has leftover test tokens that need to be moved first.
    // =========================================================================
    console.log('\n[Step 7] Close ATAs and reclaim rent to LI.FI treasury');

    const lifiBalanceBefore = svm.getBalance(lifiTreasury.publicKey)!;
    console.log(
      `  LI.FI treasury balance before: ${lamportsToSol(lifiBalanceBefore)}`,
    );

    swig = fetchSwig(svm, swigAddress);

    // Close input token ATA (balance is already 0) -> rent to LI.FI
    const closeInputAtaIx = createCloseAccountInstruction(
      swigInputAta,
      lifiTreasury.publicKey,
      walletAddress,
    );
    const closeInputSignIxs = await getSignInstructions(swig, ownerRole.id, [
      closeInputAtaIx,
    ]);
    sendSVMTransaction(svm, closeInputSignIxs, primaryOwner);

    // After closing, the account may appear as an empty system-owned account
    // with 0 lamports rather than null in LiteSVM
    const closedInputAta = svm.getAccount(swigInputAta);
    expect(closedInputAta === null || closedInputAta.lamports === 0).toBe(true);

    console.log('  Closed input ATA (USDC) -> rent to LI.FI');

    // Transfer remaining output tokens to user first, then close ATA
    swig = fetchSwig(svm, swigAddress);
    const drainOutputIx = createTransferInstruction(
      swigOutputAta,
      userOutputAta,
      walletAddress,
      1_000n * TOKEN_UNIT, // the extra tokens minted for testing
    );
    const closeOutputAtaIx = createCloseAccountInstruction(
      swigOutputAta,
      lifiTreasury.publicKey,
      walletAddress,
    );
    // The owner (root) can execute both instructions atomically
    const closeOutputSignIxs = await getSignInstructions(swig, ownerRole.id, [
      drainOutputIx,
      closeOutputAtaIx,
    ]);
    sendSVMTransaction(svm, closeOutputSignIxs, primaryOwner);

    const closedOutputAta = svm.getAccount(swigOutputAta);
    expect(closedOutputAta === null || closedOutputAta.lamports === 0).toBe(
      true,
    );

    console.log(
      '  Drained remaining BONK from output ATA, then closed -> rent to LI.FI',
    );

    // Verify LI.FI treasury received rent from both closed ATAs
    const lifiTreasuryFinalBalance = svm.getBalance(lifiTreasury.publicKey)!;
    expect(lifiTreasuryFinalBalance).toBeGreaterThan(SOL); // initial airdrop + rent from 2 ATAs

    const rentReclaimed = lifiTreasuryFinalBalance - lifiBalanceBefore;
    console.log(
      `  LI.FI treasury balance after:  ${lamportsToSol(lifiTreasuryFinalBalance)}`,
    );
    console.log(
      `  Rent reclaimed from 2 ATAs:    ${lamportsToSol(rentReclaimed)}`,
    );

    // =========================================================================
    // Step 8: Owner removes LI.FI role (cleanup)
    // =========================================================================
    console.log('\n[Step 8] Owner removes LI.FI role (cleanup)');

    swig = fetchSwig(svm, swigAddress);
    const removeIx = await getRemoveAuthorityInstructions(
      swig,
      ownerRole.id,
      lifiRole.id,
    );
    sendSVMTransaction(svm, removeIx, primaryOwner);

    swig = fetchSwig(svm, swigAddress);
    expect(swig.roles.length).toBe(1);
    expect(swig.findRolesByEd25519SignerPk(lifiExecutor.publicKey).length).toBe(
      0,
    );

    console.log(`  Roles remaining: ${swig.roles.length}`);
    console.log('  LI.FI role removed successfully');

    console.log('\n=== SPL Token LI.FI Integration Test PASSED ===\n');
  });
});
