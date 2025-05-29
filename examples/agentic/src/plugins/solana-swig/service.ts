/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  Swig,
  createEd25519AuthorityInfo,
  createSwig,
  fetchSwig,
  findSwigPda,
  signInstruction,
} from '@swig-wallet/classic';
import {
  AirdropParams,
  MintTokenParams,
  SolanaWalletInfo,
  SwigTransferParams,
  SwigWalletInfo,
  TokenBalance,
  TransferParams,
} from './types';

export class SolanaService {
  private static instance: SolanaService | null = null;
  private connection: Connection;
  private keypair: Keypair;
  private swigWallets: { swig: Swig; address: PublicKey; id: Uint8Array }[] =
    [];

  private constructor() {
    const rpcUrl = 'http://localhost:8899'; // Default to localhost
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.keypair = Keypair.generate(); // Generate a new keypair for demo
  }

  static getInstance(_runtime?: any): SolanaService {
    if (!SolanaService.instance) {
      SolanaService.instance = new SolanaService();
    }
    return SolanaService.instance;
  }

  getConnection(): Connection {
    return this.connection;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }

  async getWalletInfo(): Promise<SolanaWalletInfo> {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return {
      publicKey: this.keypair.publicKey.toString(),
      balance: balance / LAMPORTS_PER_SOL,
      keypair: this.keypair,
    };
  }

  async requestAirdrop(params: AirdropParams): Promise<string> {
    const signature = await this.connection.requestAirdrop(
      this.keypair.publicKey,
      params.amount * LAMPORTS_PER_SOL,
    );

    await this.connection.confirmTransaction(signature);
    return signature;
  }

  async createKeypair(): Promise<SolanaWalletInfo> {
    const newKeypair = Keypair.generate();
    return {
      publicKey: newKeypair.publicKey.toString(),
      balance: 0,
      keypair: newKeypair,
    };
  }

  async mintSplToken(params: MintTokenParams): Promise<string> {
    // Create mint
    const mint = await createMint(
      this.connection,
      this.keypair,
      this.keypair.publicKey,
      null,
      params.decimals,
    );

    // Get or create associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      mint,
      this.keypair.publicKey,
    );

    // Mint tokens
    await mintTo(
      this.connection,
      this.keypair,
      mint,
      tokenAccount.address,
      this.keypair.publicKey,
      params.initialSupply * Math.pow(10, params.decimals),
    );

    return mint.toString();
  }

  async transferSol(params: TransferParams): Promise<string> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey: new PublicKey(params.to),
        lamports: params.amount * LAMPORTS_PER_SOL,
      }),
    );

    const signature = await this.connection.sendTransaction(transaction, [
      this.keypair,
    ]);
    await this.connection.confirmTransaction(signature);
    return signature;
  }

  async transferSplToken(params: TransferParams): Promise<string> {
    if (!params.mint) {
      throw new Error('Mint address required for SPL token transfer');
    }

    const mint = new PublicKey(params.mint);
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      mint,
      this.keypair.publicKey,
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      mint,
      new PublicKey(params.to),
    );

    const signature = await transfer(
      this.connection,
      this.keypair,
      fromTokenAccount.address,
      toTokenAccount.address,
      this.keypair.publicKey,
      params.amount,
    );

    return signature;
  }

  async createSwigWallet(): Promise<{
    swig: Swig;
    address: PublicKey;
    id: Uint8Array;
  }> {
    // Generate a random ID for the swig
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);

    // Find the swig PDA
    const [swigAddress] = findSwigPda(id);

    // Create actions for the swig (all permissions for demo)
    const rootActions = Actions.set().all().get();

    // Create the swig
    await createSwig(
      this.connection,
      id,
      createEd25519AuthorityInfo(this.keypair.publicKey),
      rootActions,
      this.keypair.publicKey,
      [this.keypair],
    );

    // Wait for confirmation
    await this.sleep(3);

    // Fetch the created swig
    const swig = await fetchSwig(this.connection, swigAddress);

    const swigWallet = { swig, address: swigAddress, id };
    this.swigWallets.push(swigWallet);

    return swigWallet;
  }

  async getSwigWallets(): Promise<SwigWalletInfo[]> {
    const walletInfos: SwigWalletInfo[] = [];

    for (const { address } of this.swigWallets) {
      try {
        const balance = await this.connection.getBalance(address);

        // Get token balances for this swig wallet
        const tokenAccounts = await this.connection.getTokenAccountsByOwner(
          address,
          { programId: TOKEN_PROGRAM_ID },
        );

        const tokens: TokenBalance[] = [];
        for (const tokenAccount of tokenAccounts.value) {
          try {
            const accountInfo = await getAccount(
              this.connection,
              tokenAccount.pubkey,
            );
            tokens.push({
              mint: accountInfo.mint.toString(),
              amount: Number(accountInfo.amount),
              decimals: 9, // Default, should be fetched from mint
            });
          } catch (_error) {
            // Skip invalid token accounts
          }
        }

        walletInfos.push({
          address: address.toString(),
          balance: balance / LAMPORTS_PER_SOL,
          tokens,
        });
      } catch (error) {
        console.error('Error getting swig wallet info:', error);
      }
    }

    return walletInfos;
  }

  async transferToSwig(
    swigAddress: string,
    params: TransferParams,
  ): Promise<string> {
    if (params.mint) {
      // SPL token transfer
      return await this.transferSplToken({
        ...params,
        to: swigAddress,
      });
    } else {
      // SOL transfer
      return await this.transferSol({
        ...params,
        to: swigAddress,
      });
    }
  }

  async swigTransfer(params: SwigTransferParams): Promise<string> {
    // Find the swig wallet
    const swigWallet = this.swigWallets.find(
      ({ address }) => address.toString() === params.swigAddress,
    );

    if (!swigWallet) {
      throw new Error(`Swig wallet not found: ${params.swigAddress}`);
    }

    // Refresh the swig data
    await swigWallet.swig.refetch(this.connection);

    // Use the swig wallet to perform the transfer
    if (params.mint) {
      // SPL token transfer from swig
      return await this.transferSplTokenFromSwig(swigWallet, params);
    } else {
      // SOL transfer from swig
      return await this.transferSolFromSwig(swigWallet, params);
    }
  }

  private async transferSolFromSwig(
    swigWallet: { swig: Swig; address: PublicKey; id: Uint8Array },
    params: SwigTransferParams,
  ): Promise<string> {
    // Find the role that can spend SOL
    const roles = swigWallet.swig.findRolesByEd25519SignerPk(
      this.keypair.publicKey,
    );

    if (roles.length === 0) {
      throw new Error('No roles found for the current keypair');
    }

    // Find a role that can spend the requested amount
    const amountLamports = BigInt(params.amount * LAMPORTS_PER_SOL);
    const spendingRole = roles.find((role) => role.canSpendSol(amountLamports));

    if (!spendingRole) {
      throw new Error(`No role found that can spend ${params.amount} SOL`);
    }

    // Create the transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: swigWallet.address,
      toPubkey: new PublicKey(params.to),
      lamports: amountLamports,
    });

    // Sign the instruction using the Swig SDK
    const signedInstruction = await signInstruction(
      spendingRole,
      this.keypair.publicKey,
      [transferInstruction],
    );

    // Send the transaction
    const signature = await this.sendTransaction(
      signedInstruction,
      this.keypair,
    );
    return signature;
  }

  private async transferSplTokenFromSwig(
    swigWallet: { swig: Swig; address: PublicKey; id: Uint8Array },
    params: SwigTransferParams,
  ): Promise<string> {
    if (!params.mint) {
      throw new Error('Mint address required for SPL token transfer');
    }

    // Find the role that can spend tokens
    const roles = swigWallet.swig.findRolesByEd25519SignerPk(
      this.keypair.publicKey,
    );

    if (roles.length === 0) {
      throw new Error('No roles found for the current keypair');
    }

    const mint = new PublicKey(params.mint);

    // For SPL tokens, we need a role that can spend tokens
    const spendingRole = roles.find((role) =>
      role.canSpendToken(mint, BigInt(params.amount)),
    );

    if (!spendingRole) {
      throw new Error(
        `No role found that can spend ${params.amount} tokens of mint ${params.mint}`,
      );
    }

    // Get or create associated token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      mint,
      swigWallet.address,
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      mint,
      new PublicKey(params.to),
    );

    // Create the transfer instruction using the correct signature
    const signature = await transfer(
      this.connection,
      this.keypair,
      fromTokenAccount.address,
      toTokenAccount.address,
      swigWallet.address,
      params.amount,
    );

    return signature;
  }

  private async sendTransaction(
    instruction: TransactionInstruction,
    payer: Keypair,
  ): Promise<string> {
    const transaction = new Transaction();
    transaction.instructions = [instruction];
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    transaction.sign(payer);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
    );
    await this.connection.confirmTransaction(signature);
    return signature;
  }

  private sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
