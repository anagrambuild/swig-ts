// BACKEND STEP 0: Backend Swig Service
// This service handles all backend operations using delegated Swig authority
import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import {
  AccountRole,
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';
import { fetchSwig, getSignInstructions } from '@swig-wallet/kit';
import {
  createConnection,
  LAMPORTS_PER_SOL,
  type SolanaConnection,
} from './solana.js';

export class SwigService {
  private connection: SolanaConnection;
  private backendKeypair: KeyPairSigner | null = null;

  constructor() {
    this.connection = createConnection();
  }

  // BACKEND STEP 0: Initialize the backend wallet with funding
  async initialize(): Promise<void> {
    // Generate a keypair for the backend to use for signing transactions
    this.backendKeypair = await generateKeyPairSigner();
    console.log('Backend keypair generated:', this.backendKeypair.address);

    // BACKEND STEP 0: Fund the backend wallet so it can pay transaction fees
    try {
      console.log('Requesting airdrop for backend wallet...');
      await this.connection.rpc
        .requestAirdrop(
          this.backendKeypair.address,
          lamports(BigInt(LAMPORTS_PER_SOL)),
        )
        .send();

      // Brief delay to ensure airdrop is processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const balance = await this.connection.rpc
        .getBalance(this.backendKeypair.address)
        .send();

      console.log(
        `Backend wallet balance: ${Number(balance.value) / LAMPORTS_PER_SOL} SOL`,
      );
    } catch (error) {
      console.warn('Failed to airdrop to backend wallet:', error);
    }
  }

  getBackendAddress(): Address | null {
    return this.backendKeypair?.address || null;
  }

  private getSolTransferInstruction(args: {
    fromAddress: Address;
    toAddress: Address;
    lamports: number;
  }) {
    return {
      programAddress: SYSTEM_PROGRAM_ADDRESS,
      accounts: [
        {
          address: args.fromAddress,
          role: AccountRole.WRITABLE_SIGNER,
        },
        {
          address: args.toAddress,
          role: AccountRole.WRITABLE,
        },
      ],
      data: new Uint8Array(
        getTransferSolInstructionDataEncoder().encode({
          amount: args.lamports,
        }),
      ),
    };
  }

  private getTransactionMessage<Inst extends IInstruction[]>(
    instructions: Inst,
    latestBlockhash: Readonly<{
      blockhash: Blockhash;
      lastValidBlockHeight: bigint;
    }>,
    feePayer: KeyPairSigner,
    signers: KeyPairSigner[] = [],
  ) {
    return pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
      (tx) => addSignersToTransactionMessage(signers, tx),
    );
  }

  private async sendTransaction<T extends IInstruction[]>(
    instructions: T,
    payer: KeyPairSigner,
    signers: KeyPairSigner[] = [],
  ): Promise<string> {
    const { value: latestBlockhash } = await this.connection.rpc
      .getLatestBlockhash()
      .send();

    const transactionMessage = this.getTransactionMessage(
      instructions,
      latestBlockhash,
      payer,
      signers,
    );

    const signedTransaction =
      await signTransactionMessageWithSigners(transactionMessage);

    await sendAndConfirmTransactionFactory(this.connection)(signedTransaction, {
      commitment: 'finalized',
      skipPreflight: true, // Skip simulation to see real transaction failures
    });

    const signature = getSignatureFromTransaction(signedTransaction);
    return signature.toString();
  }

  // BACKEND STEP 3: Perform transfers using delegated Swig authority
  async performTransfer(
    swigAddress: Address,
    toAddress: Address,
    amount: number,
  ): Promise<string> {
    if (!this.backendKeypair) {
      throw new Error('Backend keypair not initialized');
    }

    // BACKEND STEP 3: Fetch the Swig account and find our delegated role
    const swig = await fetchSwig(this.connection.rpc, swigAddress);
    const backendRole = swig.findRolesByEd25519SignerPk(
      this.backendKeypair.address,
    )[0];

    if (!backendRole) {
      throw new Error('Backend does not have authority on this Swig account');
    }

    // BACKEND STEP 3: Verify we have permission to spend the requested amount
    if (!backendRole.actions.canSpendSol(BigInt(amount))) {
      throw new Error('Backend role cannot spend the requested amount');
    }

    // BACKEND STEP 3: Create the transfer instruction
    const transferInstruction = this.getSolTransferInstruction({
      fromAddress: swigAddress,
      toAddress,
      lamports: amount,
    });

    // BACKEND STEP 3: Get Swig signing instructions for the backend role
    const signInstructions = await getSignInstructions(swig, backendRole.id, [
      transferInstruction,
    ]);

    // BACKEND STEP 3: Execute the transaction with backend signing authority
    return this.sendTransaction(signInstructions, this.backendKeypair);
  }

  async getBalance(address: Address): Promise<number> {
    try {
      const balance = await this.connection.rpc.getBalance(address).send();
      return Number(balance.value);
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  // BACKEND STEP 4: Perform automated actions (called by scheduler or API)
  async performAutomatedAction(swigAddress: Address): Promise<string> {
    if (!this.backendKeypair) {
      throw new Error('Backend keypair not initialized');
    }

    // BACKEND STEP 4: Define the automated action (transfer small amount to backend)
    const transferAmount = 0.01 * LAMPORTS_PER_SOL; // Transfer 0.01 SOL

    return this.performTransfer(
      swigAddress,
      this.backendKeypair.address,
      transferAmount,
    );
  }
}

export const swigService = new SwigService();
