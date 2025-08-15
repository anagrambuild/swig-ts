// STEP 2: Account Funding Component
// This component handles adding SOL to the Swig account to enable backend transactions
import { useEffect, useState } from 'react';
import type { SwigAccount } from '../hooks/useSwig';
import { formatSol } from '../lib/solana';

interface Props {
  account: SwigAccount | null;
  loading: boolean;
  error: string | null;
  fundAccount: (amount: number) => Promise<void>;
  getBalance: () => Promise<number>;
  onFunded: () => void;
}

export default function AccountFunder({
  account,
  loading,
  error,
  fundAccount,
  getBalance,
  onFunded,
}: Props) {
  const [amount, setAmount] = useState('1.0');
  const [balance, setBalance] = useState(0);

  // STEP 2: Load and track account balance for this step
  useEffect(() => {
    const loadBalance = async () => {
      if (account) {
        const currentBalance = await getBalance();
        setBalance(currentBalance);
      }
    };

    loadBalance();
  }, [account, getBalance]);

  // STEP 2: Handle funding the account and notify parent when successful
  const handleFund = async () => {
    try {
      await fundAccount(parseFloat(amount));
      const newBalance = await getBalance();
      setBalance(newBalance);
      // Check if account has sufficient funds (>0.5 SOL) to proceed to next step
      if (newBalance > 500000000) {
        onFunded();
      }
    } catch (err) {
      console.error('Failed to fund account:', err);
    }
  };

  const handleRefreshBalance = async () => {
    const newBalance = await getBalance();
    setBalance(newBalance);
  };

  if (!account) {
    return (
      <div className="card opacity-50">
        <h2 className="text-2xl font-bold mb-4">Step 2: Fund Account</h2>
        <p className="text-gray-500">Create a Swig account first</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-4">Step 2: Fund Account</h2>

      <p className="text-gray-600 mb-6">
        Add SOL to your Swig account so the backend can perform transactions.
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current Balance
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold">
            {formatSol(balance)} SOL
          </span>
          <button
            onClick={handleRefreshBalance}
            className="text-primary-600 hover:text-primary-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount to Fund (SOL)
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="1.0"
          />
        </div>

        <button
          onClick={handleFund}
          disabled={loading || !amount}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Funding Account...' : `Fund Account with ${amount} SOL`}
        </button>
      </div>
    </div>
  );
}
