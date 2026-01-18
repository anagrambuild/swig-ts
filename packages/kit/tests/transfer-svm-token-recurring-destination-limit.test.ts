/**
 * Transfer SVM Token Recurring Destination Limit Test (Kit)
 *
 * Tests SPL token recurring destination limit constraints.
 * Mirrors: examples/classic/transfer/transfer-svm-token-recurring-destination-limit.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Create SPL token mint and fund swig ATA
 * 3. Add role with tokenRecurringDestinationLimit
 * 4. Test multiple transfers within recurring limit
 * 5. Test transfer exceeding limit fails
 * 6. Test transfer to unauthorized destination fails
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
import { Keypair, SystemProgram } from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '../src';
import {
  addressToPublicKey,
  fetchSwig,
  getFundedKeys,
  getSvm,
} from './context';
import {
  randomBytes,
  sendKitTransaction,
  sendSVMTransaction,
  web3InstructionToKit,
} from './utils';

const DECIMALS = 6;

describe('transfer-svm-token-recurring-destination-limit', () => {
  test('allows multiple token transfers within recurring limit', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate();
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.address),
      id: swigId,
      payer: root.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.findRoleById(0)!;
    const walletAddress = await getSwigWalletAddress(swig);

    // Create SPL token mint
    const mintKeypair = Keypair.generate();
    const mintLamports = svm.minimumBalanceForRentExemption(
      BigInt(getMintLen([])),
    );

    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: root.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: Number(mintLamports),
      space: getMintLen([]),
      programId: TOKEN_PROGRAM_ID,
    });
    const initMintIx = createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      root.publicKey,
      root.publicKey,
    );
    sendSVMTransaction(svm, [createMintAccountIx, initMintIx], root, [
      {
        address: mintKeypair.publicKey.toBase58() as any,
        publicKey: mintKeypair.publicKey,
        _keypair: mintKeypair,
      },
    ]);

    // Create swig ATA and fund with tokens
    const swigAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      addressToPublicKey(walletAddress),
      true,
    );
    const createSwigAtaIx = createAssociatedTokenAccountInstruction(
      root.publicKey,
      swigAta,
      addressToPublicKey(walletAddress),
      mintKeypair.publicKey,
    );
    sendSVMTransaction(svm, [createSwigAtaIx], root);

    const mintAmount = BigInt(10000 * 10 ** DECIMALS);
    const mintToSwigIx = createMintToInstruction(
      mintKeypair.publicKey,
      swigAta,
      root.publicKey,
      mintAmount,
    );
    sendSVMTransaction(svm, [mintToSwigIx], root);

    // Create recipient ATA
    const recipientAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      recipient.publicKey,
    );
    const createRecipientAtaIx = createAssociatedTokenAccountInstruction(
      root.publicKey,
      recipientAta,
      recipient.publicKey,
      mintKeypair.publicKey,
    );
    sendSVMTransaction(svm, [createRecipientAtaIx], root);

    // Add spender with recurring token destination limit: 500 tokens per window
    const recurringAmount = BigInt(500 * 10 ** DECIMALS);
    const window = 100n;

    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set()
        .tokenRecurringDestinationLimit({
          mint: mintKeypair.publicKey,
          recurringAmount,
          window,
          destination: recipientAta,
        })
        .get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
    expect(spenderRole).toBeDefined();

    // First transfer: 200 tokens (within limit)
    const transferAmount1 = BigInt(200 * 10 ** DECIMALS);
    const transferIx1 = createTransferInstruction(
      swigAta,
      recipientAta,
      addressToPublicKey(walletAddress),
      transferAmount1,
    );

    const signIx1 = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transferIx1),
    ]);
    sendKitTransaction(svm, signIx1, spender);

    // Verify first transfer
    const recipientAtaAccount1 = svm.getAccount(recipientAta);
    expect(recipientAtaAccount1).toBeDefined();

    // Second transfer: 300 tokens (total 500, at limit)
    swig = fetchSwig(svm, swigAddress);
    const transferAmount2 = BigInt(300 * 10 ** DECIMALS);
    const transferIx2 = createTransferInstruction(
      swigAta,
      recipientAta,
      addressToPublicKey(walletAddress),
      transferAmount2,
    );

    const signIx2 = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transferIx2),
    ]);
    sendKitTransaction(svm, signIx2, spender);
  });

  test('rejects token transfer exceeding recurring limit', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate();
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.address),
      id: swigId,
      payer: root.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.findRoleById(0)!;
    const walletAddress = await getSwigWalletAddress(swig);

    // Create SPL token mint
    const mintKeypair = Keypair.generate();
    const mintLamports = svm.minimumBalanceForRentExemption(
      BigInt(getMintLen([])),
    );

    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: root.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: Number(mintLamports),
      space: getMintLen([]),
      programId: TOKEN_PROGRAM_ID,
    });
    const initMintIx = createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      root.publicKey,
      root.publicKey,
    );
    sendSVMTransaction(svm, [createMintAccountIx, initMintIx], root, [
      {
        address: mintKeypair.publicKey.toBase58() as any,
        publicKey: mintKeypair.publicKey,
        _keypair: mintKeypair,
      },
    ]);

    // Create and fund swig ATA
    const swigAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      addressToPublicKey(walletAddress),
      true,
    );
    sendSVMTransaction(
      svm,
      [
        createAssociatedTokenAccountInstruction(
          root.publicKey,
          swigAta,
          addressToPublicKey(walletAddress),
          mintKeypair.publicKey,
        ),
      ],
      root,
    );
    sendSVMTransaction(
      svm,
      [
        createMintToInstruction(
          mintKeypair.publicKey,
          swigAta,
          root.publicKey,
          BigInt(10000 * 10 ** DECIMALS),
        ),
      ],
      root,
    );

    // Create recipient ATA
    const recipientAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      recipient.publicKey,
    );
    sendSVMTransaction(
      svm,
      [
        createAssociatedTokenAccountInstruction(
          root.publicKey,
          recipientAta,
          recipient.publicKey,
          mintKeypair.publicKey,
        ),
      ],
      root,
    );

    // Add spender with 500 token recurring limit
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set()
        .tokenRecurringDestinationLimit({
          mint: mintKeypair.publicKey,
          recurringAmount: BigInt(500 * 10 ** DECIMALS),
          window: 100n,
          destination: recipientAta,
        })
        .get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // First transfer uses up the limit
    const transferIx1 = createTransferInstruction(
      swigAta,
      recipientAta,
      addressToPublicKey(walletAddress),
      BigInt(500 * 10 ** DECIMALS),
    );
    const signIx1 = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transferIx1),
    ]);
    sendKitTransaction(svm, signIx1, spender);

    // Third transfer should fail (exceeds limit)
    swig = fetchSwig(svm, swigAddress);
    const transferIx3 = createTransferInstruction(
      swigAta,
      recipientAta,
      addressToPublicKey(walletAddress),
      BigInt(100 * 10 ** DECIMALS),
    );
    const signIx3 = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transferIx3),
    ]);

    expect(() => sendKitTransaction(svm, signIx3, spender)).toThrow();
  });

  test('rejects token transfer to unauthorized destination', async () => {
    const svm = getSvm();
    const [root, spender] = getFundedKeys(svm, 2);
    const authorizedRecipient = Keypair.generate();
    const unauthorizedRecipient = Keypair.generate();
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    // Create swig
    const createIx = await getCreateSwigInstruction({
      authorityInfo: createEd25519AuthorityInfo(root.address),
      id: swigId,
      payer: root.address,
      actions: Actions.set().all().get(),
    });
    sendKitTransaction(svm, [createIx], root);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.findRoleById(0)!;
    const walletAddress = await getSwigWalletAddress(swig);

    // Create SPL token mint
    const mintKeypair = Keypair.generate();
    const mintLamports = svm.minimumBalanceForRentExemption(
      BigInt(getMintLen([])),
    );

    sendSVMTransaction(
      svm,
      [
        SystemProgram.createAccount({
          fromPubkey: root.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          lamports: Number(mintLamports),
          space: getMintLen([]),
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          DECIMALS,
          root.publicKey,
          root.publicKey,
        ),
      ],
      root,
      [
        {
          address: mintKeypair.publicKey.toBase58() as any,
          publicKey: mintKeypair.publicKey,
          _keypair: mintKeypair,
        },
      ],
    );

    // Create and fund swig ATA
    const swigAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      addressToPublicKey(walletAddress),
      true,
    );
    sendSVMTransaction(
      svm,
      [
        createAssociatedTokenAccountInstruction(
          root.publicKey,
          swigAta,
          addressToPublicKey(walletAddress),
          mintKeypair.publicKey,
        ),
      ],
      root,
    );
    sendSVMTransaction(
      svm,
      [
        createMintToInstruction(
          mintKeypair.publicKey,
          swigAta,
          root.publicKey,
          BigInt(10000 * 10 ** DECIMALS),
        ),
      ],
      root,
    );

    // Create ATAs for both recipients
    const authorizedAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      authorizedRecipient.publicKey,
    );
    const unauthorizedAta = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      unauthorizedRecipient.publicKey,
    );

    sendSVMTransaction(
      svm,
      [
        createAssociatedTokenAccountInstruction(
          root.publicKey,
          authorizedAta,
          authorizedRecipient.publicKey,
          mintKeypair.publicKey,
        ),
        createAssociatedTokenAccountInstruction(
          root.publicKey,
          unauthorizedAta,
          unauthorizedRecipient.publicKey,
          mintKeypair.publicKey,
        ),
      ],
      root,
    );

    // Add spender with destination limit to authorized recipient only
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set()
        .tokenRecurringDestinationLimit({
          mint: mintKeypair.publicKey,
          recurringAmount: BigInt(1000 * 10 ** DECIMALS),
          window: 100n,
          destination: authorizedAta,
        })
        .get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];

    // Try to transfer to unauthorized recipient
    const transferIx = createTransferInstruction(
      swigAta,
      unauthorizedAta,
      addressToPublicKey(walletAddress),
      BigInt(100 * 10 ** DECIMALS),
    );
    const signIx = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transferIx),
    ]);

    expect(() => sendKitTransaction(svm, signIx, spender)).toThrow();
  });
});
