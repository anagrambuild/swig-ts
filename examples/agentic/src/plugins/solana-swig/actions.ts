import { SolanaService } from './service';
import {
  AirdropParams,
  MintTokenParams,
  SwigTransferParams,
  TransferParams,
} from './types';

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export class SolanaSwigActions {
  private solanaService: SolanaService;

  constructor(solanaService: SolanaService) {
    this.solanaService = solanaService;
  }

  async createKeypair(): Promise<ActionResult> {
    try {
      const walletInfo = await this.solanaService.createKeypair();
      return {
        success: true,
        message: `Created new keypair: ${walletInfo.publicKey}`,
        data: walletInfo,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create keypair: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async requestAirdrop(params: AirdropParams): Promise<ActionResult> {
    try {
      const signature = await this.solanaService.requestAirdrop(params);
      return {
        success: true,
        message: `Airdrop successful! Signature: ${signature}`,
        data: { signature },
      };
    } catch (error) {
      return {
        success: false,
        message: `Airdrop failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async mintSplToken(params: MintTokenParams): Promise<ActionResult> {
    try {
      const mintAddress = await this.solanaService.mintSplToken(params);
      return {
        success: true,
        message: `SPL token minted successfully! Mint address: ${mintAddress}`,
        data: { mintAddress },
      };
    } catch (error) {
      return {
        success: false,
        message: `Token minting failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async checkWalletBalance(): Promise<ActionResult> {
    try {
      const walletInfo = await this.solanaService.getWalletInfo();
      return {
        success: true,
        message: `Wallet balance: ${walletInfo.balance} SOL`,
        data: walletInfo,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async transferSol(params: TransferParams): Promise<ActionResult> {
    try {
      const signature = await this.solanaService.transferSol(params);
      return {
        success: true,
        message: `SOL transfer successful! Sent ${params.amount} SOL to ${params.to}. Signature: ${signature}`,
        data: { signature, amount: params.amount, recipient: params.to },
      };
    } catch (error) {
      return {
        success: false,
        message: `SOL transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async transferSplToken(params: TransferParams): Promise<ActionResult> {
    try {
      const signature = await this.solanaService.transferSplToken(params);
      return {
        success: true,
        message: `SPL token transfer successful! Sent ${params.amount} tokens to ${params.to}. Signature: ${signature}`,
        data: {
          signature,
          amount: params.amount,
          recipient: params.to,
          mint: params.mint,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `SPL token transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async createSwigWallet(): Promise<ActionResult> {
    try {
      const swigWallet = await this.solanaService.createSwigWallet();
      return {
        success: true,
        message: `Swig wallet created successfully! Address: ${swigWallet.address.toString()}`,
        data: { address: swigWallet.address.toString() },
      };
    } catch (error) {
      return {
        success: false,
        message: `Swig wallet creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getSwigWallets(): Promise<ActionResult> {
    try {
      const swigWallets = await this.solanaService.getSwigWallets();
      return {
        success: true,
        message: `Found ${swigWallets.length} Swig wallets`,
        data: swigWallets,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get Swig wallets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async transferToSwig(
    swigAddress: string,
    params: TransferParams,
  ): Promise<ActionResult> {
    try {
      const signature = await this.solanaService.transferToSwig(
        swigAddress,
        params,
      );
      const tokenType = params.mint ? 'SPL tokens' : 'SOL';
      return {
        success: true,
        message: `Transfer to Swig successful! Sent ${params.amount} ${tokenType} to Swig wallet ${swigAddress}. Signature: ${signature}`,
        data: {
          signature,
          amount: params.amount,
          swigAddress,
          mint: params.mint,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Transfer to Swig failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async swigTransfer(params: SwigTransferParams): Promise<ActionResult> {
    try {
      const signature = await this.solanaService.swigTransfer(params);
      const tokenType = params.mint ? 'SPL tokens' : 'SOL';
      return {
        success: true,
        message: `Swig transfer successful! Sent ${params.amount} ${tokenType} from Swig ${params.swigAddress} to ${params.to}. Signature: ${signature}`,
        data: {
          signature,
          amount: params.amount,
          from: params.swigAddress,
          to: params.to,
          mint: params.mint,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Swig transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
