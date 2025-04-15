export interface SwigWallet {
  isSwigWallet: boolean;
  isConnected: () => Promise<boolean>;
  connect: (options: {
    appName?: string;
    appIcon?: string;
    permissions: string[];
  }) => Promise<{
    success: boolean;
    publicKey?: string;
    role?: string;
    approvedPermissions?: string[];
    error?: string;
  }>;
  requestPermissions: (permissions: string[]) => Promise<{
    success: boolean;
    approvedPermissions?: string[];
    error?: string;
  }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: any) => Promise<{
    signature: string;
    success: boolean;
    error?: string;
  }>;
  signAllTransactions: (transactions: any[]) => Promise<{
    signatures: string[];
    success: boolean;
    error?: string;
  }>;
  signMessage: (message: Uint8Array) => Promise<{
    signature: string;
    success: boolean;
    error?: string;
  }>;
}

// Augment Window interface
declare global {
  interface Window {
    swigWallet?: SwigWallet;
  }
}

export {};
