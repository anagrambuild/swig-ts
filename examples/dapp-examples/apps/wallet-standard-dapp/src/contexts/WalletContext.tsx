import React, { createContext, useContext, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  // Add other wallet adapters as needed
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Connection } from '@solana/web3.js';

// Define your own wallet context type
interface WalletContextType {
  wallets: any[];
  selectedWallet: any | null;
  publicKey: string | null;
  connecting: boolean;
  connected: boolean;
  connectWallet: (wallet: any) => Promise<void>;
  disconnectWallet: () => void;
  signAndSendTransaction: (
    transaction: any,
    connection: Connection
  ) => Promise<string>;
}

// Create context with default undefined value
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Create a wallet provider component
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Set up wallet adapters
  const walletAdapters = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Add other wallet adapters here
    ],
    []
  );

  // Use Solana network
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={[]} autoConnect>
        <WalletContextWrapper>{children}</WalletContextWrapper>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

// Create a wrapper component that uses the Solana wallet provider
const WalletContextWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    wallets,
    wallet: selectedWallet,
    publicKey,
    connecting,
    connected,
    select,
    disconnect,
    signTransaction,
    signAllTransactions,
    sendTransaction,
  } = useSolanaWallet();

  // Convert publicKey to string if it exists
  const publicKeyString = publicKey ? publicKey.toString() : null;

  // Connect wallet function
  const connectWallet = async (wallet: any) => {
    try {
      select(wallet.adapter.name);
      // Note: The wallet adapter will handle the connection process
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  };

  // Disconnect wallet function
  const disconnectWallet = () => {
    try {
      disconnect();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Sign and send transaction function
  const signAndSendTransaction = async (
    transaction: any,
    connection: Connection
  ) => {
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Use the Solana wallet adapter to send the transaction
      const signature = await sendTransaction(transaction, connection);
      return signature;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  };

  // Create context value
  const contextValue = {
    wallets,
    selectedWallet,
    publicKey: publicKeyString,
    connecting,
    connected,
    connectWallet,
    disconnectWallet,
    signAndSendTransaction,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Create a hook to use the wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
