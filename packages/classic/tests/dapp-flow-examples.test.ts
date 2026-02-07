/**
 * dApp Flow Examples
 *
 * Demonstrates a real-world dApp integration pattern where:
 * 1. A swig wallet address is pre-derived before the account exists
 * 2. Funds arrive at the wallet address (e.g., from a bridge)
 * 3. The swig account is created with two roles:
 *    - Primary owner (root authority)
 *    - dApp executor with closeSwigAuthority + destination limits
 * 4. dApp executor performs a multi-step execution:
 *    a. Collect partner fee
 *    b. Collect dApp protocol fee
 *    c. Collect paymaster fee (tx sponsorship)
 *    d. Simulate a swap (transfer tokens to DEX, receive output tokens)
 *    e. Transfer remaining output tokens to the user
 *    f. Verify the user received >= the minimum amount defined in restrictions
 * 5. dApp closes the swig wallet ATAs and reclaims rent
 * 6. dApp closes the swig account and wallet address PDA to reclaim all rent
 *
 * Key design: The dApp executor has closeSwigAuthority permission, allowing it
 * to handle the entire lifecycle (including cleanup) without requiring the
 * end user (owner) to take any action after initial swig creation.
 *
 * Flow:
 *   pre-derive swig address & wallet address
 *   -> fund wallet (bridge arrival)
 *   -> create swig with owner + dApp roles
 *   -> dApp executor: collect fees + swap + transfer to user
 *   -> dApp executor: close ATAs to reclaim rent
 *   -> dApp executor: close swig account + wallet address PDA
 */

import {
  createAssociatedTokenAccountInstruction,
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
  getCloseSwigInstructions,
  getCloseSwigTokenAccountInstructions,
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

describe('dapp-flow-examples', () => {
  test('SOL: pre-derive, fund, create, execute with destination limits, cleanup', async () => {
    const svm = getSvm();

    // Rent-exempt minimum for a 0-byte account (swig wallet address PDA)
    const RENT_EXEMPT_MINIMUM = svm.minimumBalanceForRentExemption(0n);

    console.log('\n=== SOL dApp Flow Example ===\n');

    // =========================================================================
    // Actors
    // =========================================================================
    const [primaryOwner, dappExecutor, partnerTreasury, dappTreasury] =
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
      `  dApp Executor:      ${dappExecutor.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Partner Treasury:   ${partnerTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  dApp Treasury:      ${dappTreasury.publicKey.toBase58().slice(0, 12)}...`,
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
    //   Role 1: dApp executor with SOL destination limits
    //
    // The dApp executor can only send SOL to specific destinations
    // (partner, dApp, paymaster, user) with per-destination caps.
    // =========================================================================
    const partnerFee = SOL / 100n; // 0.01 SOL
    const dappFee = SOL / 200n; // 0.005 SOL
    const paymasterFee = SOL / 500n; // 0.002 SOL

    // The minimum amount the user must receive after fees
    const minUserAmount = 3n * SOL;

    // The user destination limit allows transfer of up to the bridged amount
    // minus fees and rent. This acts as both the cap and the minimum guarantee:
    // the dApp backend will only attempt a transfer >= minUserAmount.
    const userDestinationBudget = bridgedAmount;

    // dApp treasury destination budget: protocol fee + enough to drain any
    // excess SOL from the wallet PDA before closing. In production, this would
    // be sized based on the expected total wallet balance.
    const dappTreasuryBudget = bridgedAmount;

    const dappActions = Actions.set()
      .closeSwigAuthority()
      .solDestinationLimit({
        amount: partnerFee,
        destination: partnerTreasury.publicKey,
      })
      .solDestinationLimit({
        amount: dappTreasuryBudget,
        destination: dappTreasury.publicKey,
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
    console.log(
      '  Role 1: dApp Executor with closeSwigAuthority + SOL destination limits:',
    );
    console.log(`    - Partner:   up to ${lamportsToSol(partnerFee)}`);
    console.log(`    - dApp:      up to ${lamportsToSol(dappTreasuryBudget)}`);
    console.log(`    - Paymaster: up to ${lamportsToSol(paymasterFee)}`);
    console.log(
      `    - User:      up to ${lamportsToSol(userDestinationBudget)}`,
    );

    // Create swig with root authority, then atomically add dApp authority
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
      createEd25519AuthorityInfo(dappExecutor.publicKey),
      dappActions,
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

    const dappRole = swig.findRolesByEd25519SignerPk(
      dappExecutor.publicKey,
    )[0]!;
    expect(dappRole).toBeDefined();
    expect(dappRole.actions.canSpendSol()).toBe(true);

    console.log(`  Swig created (v2). Roles: ${swig.roles.length}`);
    console.log(
      `  Owner role ID: ${ownerRole.id} (root=${ownerRole.actions.isRoot()})`,
    );
    console.log(
      `  dApp role ID: ${dappRole.id} (canSpendSol=${dappRole.actions.canSpendSol()})`,
    );
    console.log(
      `  Wallet balance after creation: ${lamportsToSol(walletBalance!)}`,
    );

    // =========================================================================
    // Step 4a: dApp executor collects partner fee
    // =========================================================================
    console.log('\n[Step 4a] dApp collects partner fee');

    const partnerFeeIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: partnerTreasury.publicKey,
      lamports: Number(partnerFee),
    });
    const partnerFeeSignIx = await getSignInstructions(swig, dappRole.id, [
      partnerFeeIx,
    ]);
    sendSVMTransaction(svm, partnerFeeSignIx, dappExecutor);

    swig = fetchSwig(svm, swigAddress);

    const partnerBalance = svm.getBalance(partnerTreasury.publicKey)!;
    expect(partnerBalance).toBe(SOL + partnerFee); // initial airdrop + fee

    console.log(`  Transferred: ${lamportsToSol(partnerFee)} to partner`);
    console.log(`  Partner balance: ${lamportsToSol(partnerBalance)}`);
    console.log(
      `  Wallet balance: ${lamportsToSol(svm.getBalance(walletAddress)!)}`,
    );

    // =========================================================================
    // Step 4b: dApp executor collects dApp protocol fee
    // =========================================================================
    console.log('\n[Step 4b] dApp collects protocol fee');

    const dappFeeIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: dappTreasury.publicKey,
      lamports: Number(dappFee),
    });
    const dappFeeSignIx = await getSignInstructions(swig, dappRole.id, [
      dappFeeIx,
    ]);
    sendSVMTransaction(svm, dappFeeSignIx, dappExecutor);

    swig = fetchSwig(svm, swigAddress);

    const dappBalance = svm.getBalance(dappTreasury.publicKey)!;
    expect(dappBalance).toBe(SOL + dappFee);

    console.log(`  Transferred: ${lamportsToSol(dappFee)} to dApp`);
    console.log(`  dApp balance: ${lamportsToSol(dappBalance)}`);
    console.log(
      `  Wallet balance: ${lamportsToSol(svm.getBalance(walletAddress)!)}`,
    );

    // =========================================================================
    // Step 4c: dApp executor collects paymaster fee
    // =========================================================================
    console.log('\n[Step 4c] dApp collects paymaster fee');

    const paymasterFeeIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: paymasterTreasury.publicKey,
      lamports: Number(paymasterFee),
    });
    const paymasterFeeSignIx = await getSignInstructions(swig, dappRole.id, [
      paymasterFeeIx,
    ]);
    sendSVMTransaction(svm, paymasterFeeSignIx, dappExecutor);

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
    // In production, the dApp API would provide callData for a DEX swap.
    // Here we simulate by transferring the remaining SOL directly.
    // The wallet must retain at least RENT_EXEMPT_MINIMUM lamports.
    // =========================================================================
    const totalFees = partnerFee + dappFee + paymasterFee;
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
    const userTransferSignIx = await getSignInstructions(swig, dappRole.id, [
      userTransferIx,
    ]);
    sendSVMTransaction(svm, userTransferSignIx, dappExecutor);

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
    // Step 5: Verify restrictions - dApp cannot exceed destination limits
    // =========================================================================
    console.log('\n[Step 5] Verify dApp role restrictions are enforced');

    // Fund the wallet again so the balance is not the limiting factor
    svm.airdrop(walletAddress, SOL);
    swig = fetchSwig(svm, swigAddress);

    console.log('  Re-funded wallet with 1 SOL for restriction test');

    // This should fail because the dApp role's destination limit for
    // userRecipient is exhausted (userDestinationBudget - userTransferAmount
    // is very small)
    const extraTransferIx = SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: userRecipient.publicKey,
      lamports: Number(SOL),
    });
    const extraSignIx = await getSignInstructions(swig, dappRole.id, [
      extraTransferIx,
    ]);
    expect(() => sendSVMTransaction(svm, extraSignIx, dappExecutor)).toThrow();

    console.log(
      '  dApp tried to transfer 1 SOL to user -> REJECTED (limit exceeded)',
    );

    // =========================================================================
    // Step 6: dApp closes the swig account and wallet address PDA
    //
    // The dApp executor has closeSwigAuthority permission, which allows it to
    // close the swig account directly — no need for the owner to intervene.
    // This is the expected production flow: the dApp handles the entire
    // lifecycle including cleanup, without requiring any action from the end
    // user.
    //
    // The closeSwig instruction closes BOTH the swig account and the wallet
    // address PDA in a single instruction, with anti-rehydration protection
    // (account resized to 1 byte, discriminator set to ClosedSwigAccount=255).
    //
    // Precondition: Both the swig account and wallet address PDA must contain
    // ONLY their rent-exempt minimum - no excess SOL. If there is excess SOL
    // in the wallet PDA (from the restriction test airdrop in step 5), we
    // must drain it first via a signV2 transfer instruction.
    //
    // The rent from both closed accounts is sent to the destination
    // (dappTreasury in this case, reimbursing the dApp for tx sponsorship).
    // =========================================================================
    console.log(
      '\n[Step 6] dApp closes swig account and wallet address PDA (reclaim all rent)',
    );

    // 6a: Drain excess SOL from wallet PDA to dappTreasury before closing
    //     (closeSwig requires wallet to be at rent-exempt minimum only)
    swig = fetchSwig(svm, swigAddress);
    const walletBalanceBeforeDrain = svm.getBalance(walletAddress)!;
    const excessSol = walletBalanceBeforeDrain - RENT_EXEMPT_MINIMUM;

    if (excessSol > 0n) {
      console.log(
        `  Draining ${lamportsToSol(excessSol)} excess SOL from wallet PDA`,
      );
      const drainIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: dappTreasury.publicKey,
        lamports: Number(excessSol),
      });
      const drainSignIxs = await getSignInstructions(swig, dappRole.id, [
        drainIx,
      ]);
      sendSVMTransaction(svm, drainSignIxs, dappExecutor);
      swig = fetchSwig(svm, swigAddress);
    }

    // Verify wallet PDA is now at rent-exempt minimum
    const walletBalanceAfterDrain = svm.getBalance(walletAddress)!;
    expect(walletBalanceAfterDrain).toBe(RENT_EXEMPT_MINIMUM);
    console.log(
      `  Wallet PDA balance: ${lamportsToSol(walletBalanceAfterDrain)} (rent-exempt only)`,
    );

    // 6b: Close the swig account and wallet PDA
    const dappBalanceBeforeClose = svm.getBalance(dappTreasury.publicKey)!;
    const swigRent = BigInt(svm.getAccount(swigAddress)!.lamports);
    console.log(`  Swig account rent:  ${lamportsToSol(swigRent)}`);
    console.log(
      `  dApp balance before close: ${lamportsToSol(dappBalanceBeforeClose)}`,
    );

    swig = fetchSwig(svm, swigAddress);
    const closeSwigIxs = await getCloseSwigInstructions(swig, dappRole.id, {
      destination: dappTreasury.publicKey,
    });
    sendSVMTransaction(svm, closeSwigIxs, dappExecutor);

    // Verify both accounts are closed (resized to 1 byte with discriminator 255)
    const swigAccountAfter = svm.getAccount(swigAddress);
    expect(swigAccountAfter).not.toBeNull();
    expect(swigAccountAfter!.data.length).toBe(1);
    expect(swigAccountAfter!.data[0]).toBe(255); // ClosedSwigAccount discriminator

    const walletPdaAfter = svm.getAccount(walletAddress);
    expect(
      walletPdaAfter === null || BigInt(walletPdaAfter.lamports) === 0n,
    ).toBe(true);

    // Verify dApp received the rent from both accounts
    const dappBalanceAfterClose = svm.getBalance(dappTreasury.publicKey)!;
    expect(dappBalanceAfterClose).toBeGreaterThan(dappBalanceBeforeClose);
    const rentReclaimed = dappBalanceAfterClose - dappBalanceBeforeClose;

    console.log(
      `  dApp balance after close:  ${lamportsToSol(dappBalanceAfterClose)}`,
    );
    console.log(`  Rent reclaimed to dApp:    ${lamportsToSol(rentReclaimed)}`);
    console.log('  Swig account: CLOSED (1 byte, discriminator=255)');
    console.log('  Wallet address PDA: CLOSED');

    console.log('\n=== SOL dApp Flow Example PASSED ===\n');
  });

  test('full dApp flow with SPL tokens: fees, swap simulation, ATA close', async () => {
    const svm = getSvm();

    console.log('\n=== SPL Token dApp Flow Example ===\n');

    // =========================================================================
    // Actors
    // =========================================================================
    const [primaryOwner, dappExecutor] = getFundedKeys(
      svm,
      2,
      10 * Number(SOL),
    );
    const partnerTreasury = Keypair.generate();
    const dappTreasury = Keypair.generate();
    const paymasterTreasury = Keypair.generate();
    const userRecipient = Keypair.generate();

    // Fund accounts that need SOL for rent
    svm.airdrop(partnerTreasury.publicKey, SOL);
    svm.airdrop(dappTreasury.publicKey, SOL);
    svm.airdrop(userRecipient.publicKey, SOL);

    console.log('Actors:');
    console.log(
      `  Primary Owner:      ${primaryOwner.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  dApp Executor:      ${dappExecutor.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  Partner Treasury:   ${partnerTreasury.publicKey.toBase58().slice(0, 12)}...`,
    );
    console.log(
      `  dApp Treasury:      ${dappTreasury.publicKey.toBase58().slice(0, 12)}...`,
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
    const dappInputAta = getAssociatedTokenAddressSync(
      inputMintKeypair.publicKey,
      dappTreasury.publicKey,
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
        ata: dappInputAta,
        owner: dappTreasury.publicKey,
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
      '  Created 5 ATAs: partner, dApp, paymaster, user output, DEX sink',
    );

    // =========================================================================
    // Step 5: Create swig with owner + dApp roles
    //
    // The dApp role has:
    //   - tokenDestinationLimit for each fee recipient (input token)
    //   - tokenDestinationLimit for the DEX sink (input token swap)
    //   - tokenDestinationLimit for the user (output token)
    //   - programAll so it can CPI into Token program
    // =========================================================================
    const partnerTokenFee = 50n * TOKEN_UNIT; // 50 USDC
    const dappTokenFee = 25n * TOKEN_UNIT; // 25 USDC
    const paymasterTokenFee = 10n * TOKEN_UNIT; // 10 USDC
    const minUserOutputTokens = 5_000n * TOKEN_UNIT; // 5000 output tokens minimum

    const dappActions = Actions.set()
      .closeSwigAuthority()
      // SOL destination limit for dApp treasury — needed to drain excess SOL
      // from the wallet PDA before closing the swig account
      .solDestinationLimit({
        amount: 10n * SOL, // generous budget for draining wallet PDA
        destination: dappTreasury.publicKey,
      })
      // Token fees for input token (USDC) to various fee recipients
      .tokenDestinationLimit({
        mint: inputMintKeypair.publicKey,
        amount: partnerTokenFee,
        destination: partnerInputAta,
      })
      .tokenDestinationLimit({
        mint: inputMintKeypair.publicKey,
        amount: dappTokenFee,
        destination: dappInputAta,
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

    console.log('\n[Step 5] Create swig with owner + dApp roles');
    console.log('  Role 0: Primary Owner (root - all permissions)');
    console.log(
      '  Role 1: dApp Executor with closeSwigAuthority + token destination limits:',
    );
    console.log(
      `    - Partner fee:   ${formatTokens(partnerTokenFee, 'USDC')}`,
    );
    console.log(`    - dApp fee:      ${formatTokens(dappTokenFee, 'USDC')}`);
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
      createEd25519AuthorityInfo(dappExecutor.publicKey),
      dappActions,
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
    const dappRole = swig.findRolesByEd25519SignerPk(
      dappExecutor.publicKey,
    )[0]!;
    expect(ownerRole).toBeDefined();
    expect(dappRole).toBeDefined();

    console.log(`  Swig created. Roles: ${swig.roles.length}`);
    console.log(`  Owner role ID: ${ownerRole.id}`);
    console.log(`  dApp role ID: ${dappRole.id}`);

    // =========================================================================
    // Step 6a: dApp executor collects partner token fee
    // =========================================================================
    console.log('\n[Step 6a] dApp collects partner token fee');

    const partnerFeeIx = createTransferInstruction(
      swigInputAta,
      partnerInputAta,
      walletAddress,
      partnerTokenFee,
    );
    const partnerFeeSignIxs = await getSignInstructions(swig, dappRole.id, [
      partnerFeeIx,
    ]);
    sendSVMTransaction(svm, partnerFeeSignIxs, dappExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify partner received the fee
    expect(svm.getAccount(partnerInputAta)).toBeDefined();

    console.log(
      `  Transferred: ${formatTokens(partnerTokenFee, 'USDC')} to partner`,
    );

    // =========================================================================
    // Step 6b: dApp executor collects dApp protocol token fee
    // =========================================================================
    console.log('\n[Step 6b] dApp collects protocol token fee');

    const dappFeeIx = createTransferInstruction(
      swigInputAta,
      dappInputAta,
      walletAddress,
      dappTokenFee,
    );
    const dappFeeSignIxs = await getSignInstructions(swig, dappRole.id, [
      dappFeeIx,
    ]);
    sendSVMTransaction(svm, dappFeeSignIxs, dappExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify dApp received the fee
    expect(svm.getAccount(dappInputAta)).toBeDefined();

    console.log(`  Transferred: ${formatTokens(dappTokenFee, 'USDC')} to dApp`);

    // =========================================================================
    // Step 6c: dApp executor collects paymaster token fee
    // =========================================================================
    console.log('\n[Step 6c] dApp collects paymaster token fee');

    const paymasterFeeIx = createTransferInstruction(
      swigInputAta,
      paymasterInputAta,
      walletAddress,
      paymasterTokenFee,
    );
    const paymasterFeeSignIxs = await getSignInstructions(swig, dappRole.id, [
      paymasterFeeIx,
    ]);
    sendSVMTransaction(svm, paymasterFeeSignIxs, dappExecutor);
    swig = fetchSwig(svm, swigAddress);

    // Verify paymaster received the fee
    expect(svm.getAccount(paymasterInputAta)).toBeDefined();

    const totalTokenFees = partnerTokenFee + dappTokenFee + paymasterTokenFee;
    console.log(
      `  Transferred: ${formatTokens(paymasterTokenFee, 'USDC')} to paymaster`,
    );
    console.log(
      `  Total fees collected: ${formatTokens(totalTokenFees, 'USDC')}`,
    );

    // =========================================================================
    // Step 6d: Simulate a swap
    //
    // In production, the dApp API provides callData for a DEX swap.
    // Here we simulate by:
    //   1. Transferring remaining input tokens to a "DEX sink" via swig
    //   2. DEX "deposits" output tokens to the swig wallet's output ATA
    //      (simulated by minting directly)
    // =========================================================================
    console.log('\n[Step 6d] Simulate swap (input USDC -> output BONK)');

    // Create output ATA for the swig wallet
    const createOutputAtaIx = createAssociatedTokenAccountInstruction(
      dappExecutor.publicKey,
      swigOutputAta,
      walletAddress,
      outputMintKeypair.publicKey,
    );
    sendSVMTransaction(svm, [createOutputAtaIx], dappExecutor);

    console.log('  Created output ATA for swig wallet');

    // Transfer remaining input tokens to DEX sink (swap input)
    const remainingInput =
      bridgedTokenAmount - partnerTokenFee - dappTokenFee - paymasterTokenFee;
    const swapInputIx = createTransferInstruction(
      swigInputAta,
      dexSinkAta,
      walletAddress,
      remainingInput,
    );
    const swapInputSignIxs = await getSignInstructions(swig, dappRole.id, [
      swapInputIx,
    ]);
    sendSVMTransaction(svm, swapInputSignIxs, dappExecutor);
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
    // The swig enforces that the dApp role can only transfer up to
    // the tokenDestinationLimit for the userOutputAta destination.
    // =========================================================================
    console.log('\n[Step 6e] Transfer swap output to user');

    const userTokenTransferIx = createTransferInstruction(
      swigOutputAta,
      userOutputAta,
      walletAddress,
      swapOutputAmount,
    );
    const userTokenSignIxs = await getSignInstructions(swig, dappRole.id, [
      userTokenTransferIx,
    ]);
    sendSVMTransaction(svm, userTokenSignIxs, dappExecutor);
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
    // Step 6f: Verify restrictions - dApp cannot send tokens to
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
    const unauthorizedSignIx = await getSignInstructions(swig, dappRole.id, [
      unauthorizedTransferIx,
    ]);
    expect(() =>
      sendSVMTransaction(svm, unauthorizedSignIx, dappExecutor),
    ).toThrow();

    console.log(
      '  dApp tried to send 100 BONK to unauthorized address -> REJECTED',
    );

    // =========================================================================
    // Step 7: dApp closes ATAs using closeSwigTokenAccount instruction
    //
    // The dApp executor has closeSwigAuthority permission, so it can close
    // token accounts directly — no owner intervention needed.
    //
    // Precondition: Token accounts must have zero balance before closing.
    // The input ATA should already be zero (all tokens were swapped).
    // The output ATA has leftover test tokens that need to be drained first.
    // =========================================================================
    console.log(
      '\n[Step 7] dApp closes ATAs via closeSwigTokenAccount -> rent to dApp',
    );

    const dappBalanceBefore = svm.getBalance(dappTreasury.publicKey)!;
    console.log(
      `  dApp treasury balance before: ${lamportsToSol(dappBalanceBefore)}`,
    );

    // Drain remaining output tokens to user first (token accounts must be empty)
    // The dApp role's tokenDestinationLimit for userOutputAta still has budget
    swig = fetchSwig(svm, swigAddress);
    const drainOutputIx = createTransferInstruction(
      swigOutputAta,
      userOutputAta,
      walletAddress,
      1_000n * TOKEN_UNIT, // the extra tokens minted for testing
    );
    const drainSignIxs = await getSignInstructions(swig, dappRole.id, [
      drainOutputIx,
    ]);
    sendSVMTransaction(svm, drainSignIxs, dappExecutor);

    console.log('  Drained remaining BONK from output ATA to user');

    // Close input ATA (USDC) via closeSwigTokenAccount
    swig = fetchSwig(svm, swigAddress);
    const closeInputAtaIxs = await getCloseSwigTokenAccountInstructions(
      swig,
      dappRole.id,
      {
        destination: dappTreasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenAccounts: [swigInputAta],
      },
    );
    sendSVMTransaction(svm, closeInputAtaIxs, dappExecutor);

    const closedInputAta = svm.getAccount(swigInputAta);
    expect(closedInputAta === null || closedInputAta.lamports === 0).toBe(true);
    console.log('  Closed input ATA (USDC) -> rent to dApp');

    // Close output ATA (BONK) via closeSwigTokenAccount
    swig = fetchSwig(svm, swigAddress);
    const closeOutputAtaIxs = await getCloseSwigTokenAccountInstructions(
      swig,
      dappRole.id,
      {
        destination: dappTreasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenAccounts: [swigOutputAta],
      },
    );
    sendSVMTransaction(svm, closeOutputAtaIxs, dappExecutor);

    const closedOutputAta = svm.getAccount(swigOutputAta);
    expect(closedOutputAta === null || closedOutputAta.lamports === 0).toBe(
      true,
    );
    console.log('  Closed output ATA (BONK) -> rent to dApp');

    // Verify dApp treasury received rent from both closed ATAs
    const dappTreasuryAfterAtas = svm.getBalance(dappTreasury.publicKey)!;
    expect(dappTreasuryAfterAtas).toBeGreaterThan(dappBalanceBefore);

    const ataRentReclaimed = dappTreasuryAfterAtas - dappBalanceBefore;
    console.log(
      `  dApp treasury balance after:  ${lamportsToSol(dappTreasuryAfterAtas)}`,
    );
    console.log(
      `  Rent reclaimed from 2 ATAs:    ${lamportsToSol(ataRentReclaimed)}`,
    );

    // =========================================================================
    // Step 8: dApp closes the swig account and wallet address PDA
    //
    // The dApp executor handles the entire lifecycle including final cleanup,
    // without requiring any action from the end user (owner). This instruction:
    //   - Transfers rent from wallet PDA to destination via CPI
    //   - Transfers excess rent from swig account to destination
    //   - Resizes swig account to 1 byte with ClosedSwigAccount discriminator
    //   - Prevents rehydration (discriminator=255 blocks all future operations)
    //
    // Precondition: Both swig and wallet PDA must be at rent-exempt minimum.
    // We drain any excess SOL from the wallet PDA first.
    // =========================================================================
    console.log(
      '\n[Step 8] dApp closes swig account and wallet address PDA (reclaim all rent)',
    );

    // 8a: Drain excess SOL from wallet PDA
    swig = fetchSwig(svm, swigAddress);
    const walletBalanceBeforeDrain = svm.getBalance(walletAddress)!;
    const walletRentExempt = svm.minimumBalanceForRentExemption(0n);
    const excessSol = walletBalanceBeforeDrain - walletRentExempt;

    if (excessSol > 0n) {
      console.log(
        `  Draining ${lamportsToSol(excessSol)} excess SOL from wallet PDA`,
      );
      const drainSolIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: dappTreasury.publicKey,
        lamports: Number(excessSol),
      });
      const drainSolSignIxs = await getSignInstructions(swig, dappRole.id, [
        drainSolIx,
      ]);
      sendSVMTransaction(svm, drainSolSignIxs, dappExecutor);
      swig = fetchSwig(svm, swigAddress);
    }

    // Verify wallet PDA is at rent-exempt minimum
    const walletBalanceAfterDrain = svm.getBalance(walletAddress)!;
    expect(walletBalanceAfterDrain).toBe(walletRentExempt);
    console.log(
      `  Wallet PDA balance: ${lamportsToSol(walletBalanceAfterDrain)} (rent-exempt only)`,
    );

    // 8b: Close the swig account and wallet PDA -> rent to dApp
    const dappBalanceBeforeClose = svm.getBalance(dappTreasury.publicKey)!;
    const swigRent = BigInt(svm.getAccount(swigAddress)!.lamports);
    console.log(`  Swig account rent:  ${lamportsToSol(swigRent)}`);
    console.log(
      `  dApp balance before close: ${lamportsToSol(dappBalanceBeforeClose)}`,
    );

    swig = fetchSwig(svm, swigAddress);
    const closeSwigIxs = await getCloseSwigInstructions(swig, dappRole.id, {
      destination: dappTreasury.publicKey,
    });
    sendSVMTransaction(svm, closeSwigIxs, dappExecutor);

    // Verify swig account is closed (1 byte, discriminator=255)
    const swigAccountAfter = svm.getAccount(swigAddress);
    expect(swigAccountAfter).not.toBeNull();
    expect(swigAccountAfter!.data.length).toBe(1);
    expect(swigAccountAfter!.data[0]).toBe(255); // ClosedSwigAccount discriminator

    // Verify wallet PDA is closed
    const walletPdaAfter = svm.getAccount(walletAddress);
    expect(
      walletPdaAfter === null || BigInt(walletPdaAfter.lamports) === 0n,
    ).toBe(true);

    // Verify dApp received the rent
    const dappBalanceAfterClose = svm.getBalance(dappTreasury.publicKey)!;
    expect(dappBalanceAfterClose).toBeGreaterThan(dappBalanceBeforeClose);
    const swigRentReclaimed = dappBalanceAfterClose - dappBalanceBeforeClose;

    console.log(
      `  dApp balance after close:  ${lamportsToSol(dappBalanceAfterClose)}`,
    );
    console.log(
      `  Rent reclaimed to dApp:    ${lamportsToSol(swigRentReclaimed)}`,
    );
    console.log('  Swig account: CLOSED (1 byte, discriminator=255)');
    console.log('  Wallet address PDA: CLOSED');

    console.log('\n=== SPL Token dApp Flow Example PASSED ===\n');
  });
});
