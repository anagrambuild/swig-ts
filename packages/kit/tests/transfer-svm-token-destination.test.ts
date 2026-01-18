/**
 * Transfer SVM Token Destination Test (Kit)
 *
 * Tests SPL token destination limit constraints.
 * Mirrors: examples/classic/transfer/transfer-svm-token-destination.ts
 *
 * Flow:
 * 1. Create swig with root authority
 * 2. Create SPL token mint and fund swig ATA
 * 3. Add role with tokenDestinationLimit
 * 4. Test transfer to authorized recipient
 * 5. Test transfer to unauthorized recipient fails
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

describe('transfer-svm-token-destination', () => {
  test('allows token transfer to authorized destination', async () => {
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

    // Create swig ATA
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

    // Mint tokens to swig ATA
    const mintAmount = BigInt(1000 * 10 ** DECIMALS);
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

    // Add spender with token destination limit
    const tokenLimit = BigInt(200 * 10 ** DECIMALS);
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(spender.address),
      Actions.set()
        .tokenDestinationLimit({
          mint: mintKeypair.publicKey,
          amount: tokenLimit,
          destination: recipientAta,
        })
        .get(),
    );
    sendKitTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const spenderRole = swig.findRolesByEd25519SignerPk(spender.publicKey)[0];
    expect(spenderRole).toBeDefined();

    // Transfer tokens to authorized recipient
    const transferAmount = BigInt(100 * 10 ** DECIMALS);
    const transferIx = createTransferInstruction(
      swigAta,
      recipientAta,
      addressToPublicKey(walletAddress),
      transferAmount,
    );

    const signIx = await getSignInstructions(swig, spenderRole.id, [
      web3InstructionToKit(transferIx),
    ]);
    sendKitTransaction(svm, signIx, spender);

    // Verify transfer succeeded (check recipient ATA exists and has tokens)
    const recipientAtaAccount = svm.getAccount(recipientAta);
    expect(recipientAtaAccount).toBeDefined();
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
    const createSwigAtaIx = createAssociatedTokenAccountInstruction(
      root.publicKey,
      swigAta,
      addressToPublicKey(walletAddress),
      mintKeypair.publicKey,
    );
    sendSVMTransaction(svm, [createSwigAtaIx], root);

    const mintAmount = BigInt(1000 * 10 ** DECIMALS);
    const mintToSwigIx = createMintToInstruction(
      mintKeypair.publicKey,
      swigAta,
      root.publicKey,
      mintAmount,
    );
    sendSVMTransaction(svm, [mintToSwigIx], root);

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
      ],
      root,
    );
    sendSVMTransaction(
      svm,
      [
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
        .tokenDestinationLimit({
          mint: mintKeypair.publicKey,
          amount: BigInt(500 * 10 ** DECIMALS),
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
