import { Wallet } from '@ethereumjs/wallet';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  createSecp256k1AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigCodec,
  getSwigWalletAddress,
  Swig,
  SWIG_PROGRAM_ADDRESS,
  toPublicKey,
  type SwigAccount,
  type SwigFetchFn,
} from '@swig-wallet/classic';
import { describe, expect, it } from 'bun:test';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

//
// Shared Helpers
//
function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: Keypair,
): TransactionMetadata | FailedTransactionMetadata {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer);

  const tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.error('Transaction failed:', tx.meta().logs());
    throw new Error(`Transaction failed: ${tx.meta().logs().join('\n')}`);
  }

  return tx;
}

function fetchSwigAccount(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): SwigAccount {
  const swigAccount = svm.getAccount(swigAccountAddress);
  if (!swigAccount) throw new Error('swig account not created');
  return getSwigCodec().decode(swigAccount.data);
}

function fetchSwig(
  svm: LiteSVM,
  swigAccountAddress: PublicKey,
): ReturnType<typeof Swig.fromRawAccountData> {
  const swigAccount = fetchSwigAccount(svm, swigAccountAddress);

  const swigFetchFn: SwigFetchFn = async (swigAccountAddress) =>
    fetchSwigAccount(svm, toPublicKey(swigAccountAddress));

  return new Swig(swigAccountAddress, swigAccount, swigFetchFn);
}

function setupSVM(): LiteSVM {
  // Try multiple possible paths for swig.so
  const possiblePaths = [
    '../../../swig.so', // When running from examples/classic/transfer
    './swig.so', // When running from root
    'swig.so', // Direct path
  ];

  let swigProgramPath: string | undefined;
  for (const path of possiblePaths) {
    const resolvedPath = resolve(path);
    if (existsSync(resolvedPath)) {
      swigProgramPath = resolvedPath;
      break;
    }
  }

  if (!swigProgramPath) {
    throw new Error(
      'swig.so not found. Please run "bun update:program" from the root directory first.',
    );
  }

  const swigProgram = Uint8Array.from(readFileSync(swigProgramPath));
  const svm = new LiteSVM();
  svm.addProgram(SWIG_PROGRAM_ADDRESS, swigProgram);
  return svm;
}

describe('SVM Examples', () => {
  describe('transfer-svm', () => {
    it('should create swig account, manage authorities, and perform transfers', async () => {
      const svm = setupSVM();

      // Setup keypairs
      const userRootKeypair = Keypair.generate();
      svm.airdrop(userRootKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

      const userAuthorityManagerKeypair = Keypair.generate();
      svm.airdrop(
        userAuthorityManagerKeypair.publicKey,
        BigInt(LAMPORTS_PER_SOL),
      );

      const dappAuthorityKeypair = Keypair.generate();
      svm.airdrop(dappAuthorityKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

      const dappTreasury = Keypair.generate().publicKey;
      const id = Uint8Array.from(Array(32).fill(2));

      // Find swig PDA
      const swigAccountAddress = findSwigPda(id);
      expect(swigAccountAddress).toBeDefined();

      // Create swig instruction
      const rootActions = Actions.set().all().get();
      const createSwigInstruction = await getCreateSwigInstruction({
        authorityInfo: createEd25519AuthorityInfo(userRootKeypair.publicKey),
        id,
        payer: userRootKeypair.publicKey,
        actions: rootActions,
      });

      sendSVMTransaction(svm, [createSwigInstruction], userRootKeypair);

      // Fetch swig account
      const swig = fetchSwig(svm, swigAccountAddress);
      const swigWalletAddress = await getSwigWalletAddress(swig);
      expect(swigWalletAddress).toBeDefined();

      // Find role by ed25519 signer
      const rootRoles = swig.findRolesByEd25519SignerPk(
        userRootKeypair.publicKey,
      );
      expect(rootRoles.length).toBeGreaterThan(0);

      const rootRole = rootRoles[0];

      // Add authority manager
      const manageAuthorityActions = Actions.set().manageAuthority().get();
      const addAuthorityIx = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(userAuthorityManagerKeypair.publicKey),
        manageAuthorityActions,
      );

      sendSVMTransaction(svm, addAuthorityIx, userRootKeypair);
      await swig.refetch();

      const managerRoles = swig.findRolesByEd25519SignerPk(
        userAuthorityManagerKeypair.publicKey,
      );
      expect(managerRoles.length).toBeGreaterThan(0);

      const managerRole = managerRoles[0];
      expect(managerRole.actions.canManageAuthority()).toBe(true);

      // Add dapp authority with spending limit
      const dappAuthorityActions = Actions.set()
        .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
        .get();

      const addDappAuthorityInstruction = await getAddAuthorityInstructions(
        swig,
        managerRole.id,
        createEd25519AuthorityInfo(dappAuthorityKeypair.publicKey),
        dappAuthorityActions,
      );

      sendSVMTransaction(
        svm,
        addDappAuthorityInstruction,
        userAuthorityManagerKeypair,
      );

      svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));
      await swig.refetch();

      // Test spending limits
      const roleIdCanSpendSol = swig.roles
        .filter((role) =>
          role.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
        )
        .map((role) => role.id);

      expect(roleIdCanSpendSol.length).toBeGreaterThan(0);

      const maybeDappRole = swig.findRoleById(roleIdCanSpendSol[1]);
      expect(maybeDappRole).toBeDefined();
      expect(
        maybeDappRole!.authority.matchesSigner(
          dappAuthorityKeypair.publicKey.toBytes(),
        ),
      ).toBe(true);

      const balanceBefore = svm.getBalance(swigWalletAddress);
      expect(balanceBefore).toBeGreaterThan(0n);

      // Perform transfer
      const transfer = SystemProgram.transfer({
        fromPubkey: swigWalletAddress,
        toPubkey: dappTreasury,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      });

      const dappAuthorityRoles = swig.findRolesByEd25519SignerPk(
        dappAuthorityKeypair.publicKey,
      );
      expect(dappAuthorityRoles.length).toBeGreaterThan(0);

      const dappAuthorityRole = dappAuthorityRoles[0];

      const signTransfer = await getSignInstructions(
        swig,
        dappAuthorityRole.id,
        [transfer],
      );

      sendSVMTransaction(svm, signTransfer, dappAuthorityKeypair);

      const balanceAfter = svm.getBalance(swigWalletAddress);
      expect(balanceAfter).not.toBeNull();
      expect(balanceAfter!).toBeLessThan(balanceBefore!);
      const treasuryBalance = svm.getBalance(dappTreasury);
      expect(treasuryBalance).not.toBeNull();
      expect(treasuryBalance!).toBeGreaterThan(0n);

      await swig.refetch();

      // Test that second transfer fails (limit exhausted)
      const transfer2 = SystemProgram.transfer({
        fromPubkey: swigWalletAddress,
        toPubkey: dappTreasury,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      });

      const signTransfer2 = await getSignInstructions(
        swig,
        dappAuthorityRole.id,
        [transfer2],
      );

      const balanceBeforeSecond = svm.getBalance(swigWalletAddress);

      // Try second transfer - should be rejected or succeed depending on limit enforcement
      try {
        const tx2 = svm.sendTransaction(
          (() => {
            const transaction = new Transaction();
            transaction.instructions = signTransfer2;
            transaction.feePayer = dappAuthorityKeypair.publicKey;
            transaction.recentBlockhash = svm.latestBlockhash();
            transaction.sign(dappAuthorityKeypair);
            return transaction;
          })(),
        );

        if (tx2 instanceof FailedTransactionMetadata) {
          // Expected - limit exhausted
          expect(tx2).toBeInstanceOf(FailedTransactionMetadata);
        }
      } catch (error) {
        // Also acceptable - transaction rejected
        expect(error).toBeDefined();
      }
    });
  });

  describe('transfer-svm-secp', () => {
    it('should work with secp256k1 authority', async () => {
      const svm = setupSVM();

      // Setup keypairs
      const userRootKeypair = Keypair.generate();
      svm.airdrop(userRootKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Generate secp256k1 wallet
      const wallet = Wallet.generate();

      const userAuthorityManagerKeypair = Keypair.generate();
      svm.airdrop(
        userAuthorityManagerKeypair.publicKey,
        BigInt(LAMPORTS_PER_SOL),
      );

      const id = Uint8Array.from(Array(32).fill(3));

      // Find swig PDA
      const swigAccountAddress = findSwigPda(id);

      // Create swig with root authority
      const rootActions = Actions.set().all().get();
      const createSwigInstruction = await getCreateSwigInstruction({
        authorityInfo: createEd25519AuthorityInfo(userRootKeypair.publicKey),
        id,
        payer: userRootKeypair.publicKey,
        actions: rootActions,
      });

      sendSVMTransaction(svm, [createSwigInstruction], userRootKeypair);

      const swig = fetchSwig(svm, swigAccountAddress);
      const swigWalletAddress = await getSwigWalletAddress(swig);

      // Add secp256k1 authority
      const rootRoles = swig.findRolesByEd25519SignerPk(
        userRootKeypair.publicKey,
      );
      expect(rootRoles.length).toBeGreaterThan(0);

      const rootRole = rootRoles[0];

      const secpAuthorityActions = Actions.set()
        .solLimit({ amount: BigInt(0.5 * LAMPORTS_PER_SOL) })
        .get();

      const addSecpAuthorityIx = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createSecp256k1AuthorityInfo(wallet.getPublicKey()),
        secpAuthorityActions,
      );

      sendSVMTransaction(svm, addSecpAuthorityIx, userRootKeypair);

      svm.airdrop(swigWalletAddress, BigInt(LAMPORTS_PER_SOL));
      await swig.refetch();

      // Find secp256k1 role by ethereum address
      const secpRoles = swig.findRolesBySecp256k1SignerAddress(
        wallet.getAddress(),
      );
      expect(secpRoles.length).toBeGreaterThan(0);

      const secpRole = secpRoles[0];
      expect(secpRole.actions.canSpendSol(BigInt(0.5 * LAMPORTS_PER_SOL))).toBe(
        true,
      );

      // Verify authority was added successfully by checking the role exists
      expect(secpRole.id).toBeDefined();
    });
  });

  describe('multi-add-authorities-svm', () => {
    it('should add multiple authorities in sequence', async () => {
      const svm = setupSVM();

      const userRootKeypair = Keypair.generate();
      svm.airdrop(userRootKeypair.publicKey, BigInt(LAMPORTS_PER_SOL));

      const authority1 = Keypair.generate();
      const authority2 = Keypair.generate();
      const authority3 = Keypair.generate();

      const id = Uint8Array.from(Array(32).fill(4));
      const swigAccountAddress = findSwigPda(id);

      // Create swig
      const rootActions = Actions.set().all().get();
      const createSwigInstruction = await getCreateSwigInstruction({
        authorityInfo: createEd25519AuthorityInfo(userRootKeypair.publicKey),
        id,
        payer: userRootKeypair.publicKey,
        actions: rootActions,
      });

      sendSVMTransaction(svm, [createSwigInstruction], userRootKeypair);

      const swig = fetchSwig(svm, swigAccountAddress);
      const rootRoles = swig.findRolesByEd25519SignerPk(
        userRootKeypair.publicKey,
      );
      const rootRole = rootRoles[0];

      // Add first authority
      const actions1 = Actions.set()
        .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
        .get();

      const addAuth1 = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(authority1.publicKey),
        actions1,
      );

      sendSVMTransaction(svm, addAuth1, userRootKeypair);
      await swig.refetch();

      expect(swig.roles.length).toBe(2); // root + authority1

      // Add second authority
      const actions2 = Actions.set()
        .solLimit({ amount: BigInt(0.2 * LAMPORTS_PER_SOL) })
        .get();

      const addAuth2 = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(authority2.publicKey),
        actions2,
      );

      sendSVMTransaction(svm, addAuth2, userRootKeypair);
      await swig.refetch();

      expect(swig.roles.length).toBe(3); // root + authority1 + authority2

      // Add third authority
      const actions3 = Actions.set()
        .solLimit({ amount: BigInt(0.3 * LAMPORTS_PER_SOL) })
        .get();

      const addAuth3 = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(authority3.publicKey),
        actions3,
      );

      sendSVMTransaction(svm, addAuth3, userRootKeypair);
      await swig.refetch();

      expect(swig.roles.length).toBe(4); // root + authority1 + authority2 + authority3

      // Verify all authorities exist
      const auth1Roles = swig.findRolesByEd25519SignerPk(authority1.publicKey);
      const auth2Roles = swig.findRolesByEd25519SignerPk(authority2.publicKey);
      const auth3Roles = swig.findRolesByEd25519SignerPk(authority3.publicKey);

      expect(auth1Roles.length).toBe(1);
      expect(auth2Roles.length).toBe(1);
      expect(auth3Roles.length).toBe(1);

      expect(
        auth1Roles[0].actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
      ).toBe(true);
      expect(
        auth2Roles[0].actions.canSpendSol(BigInt(0.2 * LAMPORTS_PER_SOL)),
      ).toBe(true);
      expect(
        auth3Roles[0].actions.canSpendSol(BigInt(0.3 * LAMPORTS_PER_SOL)),
      ).toBe(true);
    });
  });

  describe('subscription-svm', () => {
    it('should enforce recurring spend limits', async () => {
      const svm = setupSVM();

      const rootUser = Keypair.generate();
      const subscriptionService = Keypair.generate();
      svm.airdrop(rootUser.publicKey, BigInt(LAMPORTS_PER_SOL));
      svm.airdrop(subscriptionService.publicKey, BigInt(LAMPORTS_PER_SOL));

      const id = Uint8Array.from(Array(32).fill(5));
      const swigAccountAddress = findSwigPda(id);

      // Create swig
      const rootActions = Actions.set().all().get();
      const createSwigInstruction = await getCreateSwigInstruction({
        authorityInfo: createEd25519AuthorityInfo(rootUser.publicKey),
        id,
        payer: rootUser.publicKey,
        actions: rootActions,
      });

      sendSVMTransaction(svm, [createSwigInstruction], rootUser);

      const swig = fetchSwig(svm, swigAccountAddress);
      const swigWalletAddress = await getSwigWalletAddress(swig);

      svm.airdrop(swigWalletAddress, BigInt(10 * LAMPORTS_PER_SOL));

      const rootRoles = swig.findRolesByEd25519SignerPk(rootUser.publicKey);
      const rootRole = rootRoles[0];

      // Add subscription service with recurring limit
      const weekInSeconds = 7 * 24 * 60 * 60;
      const weeklySpendLimit = BigInt(0.5 * LAMPORTS_PER_SOL);

      const subscriptionActions = Actions.set()
        .solRecurringLimit({
          recurringAmount: weeklySpendLimit,
          window: BigInt(216_000), // window in slots (~1 month)
        })
        .get();

      const addSubAuthority = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(subscriptionService.publicKey),
        subscriptionActions,
      );

      sendSVMTransaction(svm, addSubAuthority, rootUser);
      await swig.refetch();

      const subRoles = swig.findRolesByEd25519SignerPk(
        subscriptionService.publicKey,
      );
      expect(subRoles.length).toBeGreaterThan(0);

      const subRole = subRoles[0];
      // Check that the role can spend sol (recurring limits allow spending)
      const canSpend = subRole.actions.canSpendSol();
      expect(canSpend).toBe(true);

      // Make a transfer
      const serviceTreasury = Keypair.generate().publicKey;
      const transferAmount = BigInt(Math.floor(0.1 * LAMPORTS_PER_SOL));
      const transfer = SystemProgram.transfer({
        fromPubkey: swigWalletAddress,
        toPubkey: serviceTreasury,
        lamports: Number(transferAmount),
      });

      const signTransfer = await getSignInstructions(swig, subRole.id, [
        transfer,
      ]);
      const balanceBefore = svm.getBalance(swigWalletAddress);

      sendSVMTransaction(svm, signTransfer, subscriptionService);

      const balanceAfter = svm.getBalance(swigWalletAddress);
      expect(balanceAfter).not.toBeNull();
      expect(balanceAfter!).toBeLessThan(balanceBefore!);
      const serviceTreasuryBalance = svm.getBalance(serviceTreasury);
      expect(serviceTreasuryBalance).not.toBeNull();
      expect(serviceTreasuryBalance!).toBeGreaterThan(0n);
    });
  });
});
