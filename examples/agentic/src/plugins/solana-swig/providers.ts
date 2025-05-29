/* eslint-disable @typescript-eslint/no-unused-vars */
import { getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaService } from './service';

// Simplified provider interface for standalone implementation
export interface ProviderContext {
  solanaService: SolanaService;
}

export interface Provider {
  get(context: ProviderContext): Promise<string | null>;
}

export const walletProvider: Provider = {
  async get(context: ProviderContext): Promise<string | null> {
    try {
      const walletInfo = await context.solanaService.getWalletInfo();

      return `Solana Wallet:
Address: ${walletInfo.publicKey}
SOL Balance: ${walletInfo.balance} SOL`;
    } catch (error) {
      console.error('Error in wallet provider:', error);
      return null;
    }
  },
};

export const balanceProvider: Provider = {
  async get(context: ProviderContext): Promise<string | null> {
    try {
      const connection = context.solanaService.getConnection();
      const keypair = context.solanaService.getKeypair();

      // Get SOL balance
      const solBalance = await connection.getBalance(keypair.publicKey);
      const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;

      // Get token balances
      const tokenAccounts = await connection.getTokenAccountsByOwner(
        keypair.publicKey,
        { programId: TOKEN_PROGRAM_ID },
      );

      let tokenBalances = '';
      for (const tokenAccount of tokenAccounts.value) {
        try {
          const accountInfo = await getAccount(connection, tokenAccount.pubkey);
          const balance = Number(accountInfo.amount);
          if (balance > 0) {
            tokenBalances += `\nToken: ${accountInfo.mint.toString()}, Balance: ${balance}`;
          }
        } catch (_error) {
          // Skip invalid token accounts
        }
      }

      return `Wallet Balances:
SOL: ${solBalanceFormatted} SOL${tokenBalances}`;
    } catch (error) {
      console.error('Error in balance provider:', error);
      return null;
    }
  },
};

export const swigProvider: Provider = {
  async get(context: ProviderContext): Promise<string | null> {
    try {
      const swigWallets = await context.solanaService.getSwigWallets();

      if (swigWallets.length === 0) {
        return 'No Swig wallets found.';
      }

      let result = 'Swig Wallets:\n';
      for (const swig of swigWallets) {
        result += `Address: ${swig.address}\n`;
        result += `SOL Balance: ${swig.balance} SOL\n`;
        if (swig.tokens.length > 0) {
          result += 'Tokens:\n';
          for (const token of swig.tokens) {
            result += `  - ${token.symbol || token.mint}: ${token.amount}\n`;
          }
        }
        result += '\n';
      }

      return result.trim();
    } catch (error) {
      console.error('Error in swig provider:', error);
      return null;
    }
  },
};

// Helper function to create provider context
export function createProviderContext(
  solanaService: SolanaService,
): ProviderContext {
  return { solanaService };
}

// Helper function to get all provider data
export async function getAllProviderData(context: ProviderContext): Promise<{
  wallet: string | null;
  balance: string | null;
  swig: string | null;
}> {
  const [wallet, balance, swig] = await Promise.all([
    walletProvider.get(context),
    balanceProvider.get(context),
    swigProvider.get(context),
  ]);

  return { wallet, balance, swig };
}
