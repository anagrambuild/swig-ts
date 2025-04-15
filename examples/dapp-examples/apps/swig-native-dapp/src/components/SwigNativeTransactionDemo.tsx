import React, { useState } from 'react';
import { Button } from '@swig/ui';
import { SwigWallet } from '../types/swig';

// Simplified transaction type for demonstration
interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  type: string;
}

interface SwigNativeTransactionDemoProps {
  publicKey: string;
}

const SwigNativeTransactionDemo: React.FC<SwigNativeTransactionDemoProps> = ({
  publicKey,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create a mock transaction for demonstration
  const createMockTransaction = (): Transaction => {
    return {
      id: `tx-${Math.random().toString(36).substring(2, 9)}`,
      from: publicKey,
      to: '7KBfz6SuYGZbLvEV9JnAEvR9u4skXNViR6QZkTcKjxD6', // Example recipient
      amount: 0.01, // SOL amount
      type: 'transfer',
    };
  };

  // Sign a single transaction
  const handleSignTransaction = async () => {
    if (!window.swigWallet) {
      setError('Swig Wallet not available');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const mockTransaction = createMockTransaction();

      // In a real app, you would create a proper Solana transaction here
      const response = await window.swigWallet.signTransaction(mockTransaction);

      if (response.success) {
        setResult(
          `Transaction signed successfully! Signature: ${response.signature.substring(
            0,
            16
          )}...`
        );
      } else {
        setError(`Failed to sign transaction: ${response.error}`);
      }
    } catch (err) {
      setError(
        `Error signing transaction: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // Sign multiple transactions
  const handleSignMultipleTransactions = async () => {
    if (!window.swigWallet) {
      setError('Swig Wallet not available');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Create multiple mock transactions
      const mockTransactions = [
        createMockTransaction(),
        createMockTransaction(),
        createMockTransaction(),
      ];

      // In a real app, you would create proper Solana transactions here
      const response = await window.swigWallet.signAllTransactions(
        mockTransactions
      );

      if (response.success) {
        setResult(
          `Signed ${response.signatures.length} transactions successfully!`
        );
      } else {
        setError(`Failed to sign transactions: ${response.error}`);
      }
    } catch (err) {
      setError(
        `Error signing transactions: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className='text-xl font-medium text-gray-900'>
        Transaction Signing Demo
      </h2>
      <p className='mt-2 text-sm text-gray-600'>
        Test transaction signing capabilities using Swig's role-based
        permissions.
      </p>

      {error && (
        <div className='mt-4 p-3 bg-red-100 text-red-700 rounded-md'>
          {error}
        </div>
      )}

      {result && (
        <div className='mt-4 p-3 bg-green-100 text-green-700 rounded-md'>
          {result}
        </div>
      )}

      <div className='mt-4 space-x-4'>
        <Button
          onClick={handleSignTransaction}
          disabled={loading}
          variant='primary'
        >
          {loading ? 'Signing...' : 'Sign Transaction'}
        </Button>

        <Button
          onClick={handleSignMultipleTransactions}
          disabled={loading}
          variant='secondary'
        >
          {loading ? 'Signing...' : 'Sign Multiple Transactions'}
        </Button>
      </div>
    </div>
  );
};

export default SwigNativeTransactionDemo;
