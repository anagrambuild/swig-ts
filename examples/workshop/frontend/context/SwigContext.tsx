import type { Address } from '@solana/kit';
import { createContext, ReactNode, useContext } from 'react';
import { useSwig, type SwigAccount } from '../hooks/useSwig';

interface SwigContextType {
  account: SwigAccount | null;
  loading: boolean;
  error: string | null;
  createAccount: () => Promise<SwigAccount>;
  fundAccount: (amount: number) => Promise<void>;
  delegateToBackend: (backendAddress: Address) => Promise<void>;
  getBalance: () => Promise<number>;
}

const SwigContext = createContext<SwigContextType | null>(null);

interface SwigProviderProps {
  children: ReactNode;
}

export function SwigProvider({ children }: SwigProviderProps) {
  const swigState = useSwig();

  return (
    <SwigContext.Provider value={swigState}>{children}</SwigContext.Provider>
  );
}

export function useSwigContext() {
  const context = useContext(SwigContext);
  if (!context) {
    throw new Error('useSwigContext must be used within a SwigProvider');
  }
  return context;
}
