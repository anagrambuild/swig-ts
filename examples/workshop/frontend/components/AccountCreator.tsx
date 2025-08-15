// STEP 1: Account Creation Component
// This component handles the first step of the Swig workshop: creating a new Swig account
import { useState } from 'react';
import type { SwigAccount } from '../hooks/useSwig';
import { formatSol } from '../lib/solana';
import SwigAccountDetails from './SwigAccountDetails';

interface Props {
  account: SwigAccount | null;
  loading: boolean;
  error: string | null;
  createAccount: () => Promise<SwigAccount>;
  getBalance: () => Promise<number>;
  refreshSwig: () => Promise<void>;
  onAccountCreated: () => void;
}

export default function AccountCreator({
  account,
  loading,
  error,
  createAccount,
  getBalance,
  refreshSwig,
  onAccountCreated,
}: Props) {
  const [balance, setBalance] = useState(0);

  // STEP 1: Handle account creation and update balance
  const handleCreateAccount = async () => {
    try {
      await createAccount();
      // Allow transaction to process on the blockchain
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const newBalance = await getBalance();
      setBalance(newBalance);
      onAccountCreated(); // Notify parent component of successful creation
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const handleRefreshBalance = async () => {
    const newBalance = await getBalance();
    setBalance(newBalance);
  };

  // STEP 1: Show success state and account details after creation
  if (account) {
    return (
      <div className="space-y-6">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4 text-green-600">
            ✅ Swig Account Created
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Balance
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
          </div>
        </div>

        <SwigAccountDetails account={account} refreshSwig={refreshSwig} />
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-4">Step 1: Create Swig Account</h2>

      <p className="text-gray-600 mb-6">
        Create a new Swig account that will be used for delegation to the
        backend.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleCreateAccount}
        disabled={loading}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating Account...' : 'Create Swig Account'}
      </button>
    </div>
  );
}
