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
  sendTransactionWithoutConfirmingFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';
import {
  fetchSwig,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';
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
    console.log(
      'Backend keypair generated:',
      this.backendKeypair.address.toString(),
    );

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
        `Backend wallet balance: ${Number(balance.value) / Number(LAMPORTS_PER_SOL)} SOL`,
      );
    } catch (error) {
      console.warn('Failed to airdrop to backend wallet:', error);
    }
  }

  getBackendAddress(): Address | null {
    return this.backendKeypair?.address || null;
  }

  getConnection(): SolanaConnection {
    return this.connection;
  }

  private getSolTransferInstruction(args: {
    fromAddress: Address;
    toAddress: Address;
    lamports: bigint;
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
    } satisfies IInstruction;
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

  // Polling-based confirmation without websockets
  private async confirmTransaction(
    signature: string,
    commitment: 'confirmed' | 'finalized' = 'finalized',
  ): Promise<void> {
    const maxAttempts = 667; // ~60 seconds max (667 * 90ms ≈ 60s)
    const delayMs = 90; // 90ms between attempts

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { value: statuses } = await this.connection.rpc
        .getSignatureStatuses([signature as any])
        .send();

      const status = statuses[0];
      if (status) {
        if (status.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }
        if (
          status.confirmationStatus === commitment ||
          status.confirmationStatus === 'finalized'
        ) {
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(
      `Transaction confirmation timeout after ${maxAttempts} attempts`,
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

    // Get signature before sending
    const signature = getSignatureFromTransaction(signedTransaction);

    // Send transaction using RPC only (no websocket)
    const sendTransactionWithoutConfirming =
      sendTransactionWithoutConfirmingFactory({
        rpc: this.connection.rpc,
      });

    await sendTransactionWithoutConfirming(signedTransaction, {
      commitment: 'finalized',
      skipPreflight: true, // Skip simulation to see real transaction failures
    });

    // Poll for confirmation
    await this.confirmTransaction(signature.toString(), 'finalized');

    return signature.toString();
  }

  // BACKEND STEP 3: Perform transfers using delegated Swig authority
  async performTransfer(
    swigAddress: Address,
    toAddress: Address,
    amount: number,
  ): Promise<string> {
    if (!this.backendKeypair) {
      throw new Error('Backend not initialized');
    }

    try {
      // Fetch the Swig account to get current state
      const swig = await fetchSwig(this.connection.rpc, swigAddress);
      // Refetch to ensure we have the latest state including any recent delegations
      await swig.refetch();
      const swigWalletAddress = await getSwigWalletAddress(swig);

      const backendAddress = this.backendKeypair.address;
      console.log(
        `Looking for backend role with address: ${backendAddress.toString()}`,
      );

      // Find the backend's role in the Swig account
      const backendRole = swig.findRolesByEd25519SignerPk(backendAddress)[0];

      if (!backendRole) {
        // Log all roles for debugging
        console.log(
          `Backend address looking for: ${backendAddress.toString()}`,
        );
        console.log('Available roles in Swig account:');
        swig.roles.forEach((role, idx) => {
          console.log(
            `  Role ${idx}: id=${role.id}, authorityType=${role.authorityType}`,
          );
          // Check if this role matches the backend address
          const matchingRoles = swig.findRolesByEd25519SignerPk(backendAddress);
          if (matchingRoles.some((r) => r.id === role.id)) {
            console.log(`    ✓ This role matches backend address!`);
          }
        });
        throw new Error(
          `Backend role not found in Swig account. Backend address: ${backendAddress.toString()}. Make sure you delegated to this address and the backend hasn't restarted (which would generate a new keypair).`,
        );
      }

      // Check if backend can spend the requested amount
      const amountLamports = BigInt(amount * Number(LAMPORTS_PER_SOL));
      if (!backendRole.actions.canSpendSol(amountLamports)) {
        throw new Error(
          `Backend cannot spend ${amount} SOL (limit exceeded or no permission)`,
        );
      }

      // Create transfer instruction
      const transferInstruction = this.getSolTransferInstruction({
        fromAddress: swigWalletAddress,
        toAddress,
        lamports: amountLamports,
      });

      // Get current slot for deterministic signing
      const currentSlot = BigInt(
        await this.connection.rpc.getSlot({ commitment: 'finalized' }).send(),
      );

      // Get sign instructions from Swig
      const signInstructions = await getSignInstructions(
        swig,
        backendRole.id,
        [transferInstruction],
        false,
        {
          payer: this.backendKeypair.address,
          currentSlot,
        },
      );

      // Send the transaction
      const signature = await this.sendTransaction(
        signInstructions,
        this.backendKeypair,
      );

      console.log(
        `Transfer successful: ${amount} SOL from ${swigWalletAddress.toString()} to ${toAddress.toString()}`,
      );
      console.log(`Transaction signature: ${signature}`);

      return signature;
    } catch (error) {
      console.error('Error performing transfer:', error);
      throw error;
    }
  }
}
