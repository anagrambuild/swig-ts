'use client';

import { useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import type { SwigAccount } from '../hooks/useSwig';
import { formatSol } from '../lib/solana';
import SwigAccountDetails from './SwigAccountDetails';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';

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
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <CardTitle className="text-2xl text-emerald-900">
                Swig Account Created
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Balance
              </label>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold text-slate-900">
                  {formatSol(balance)} SOL
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshBalance}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <SwigAccountDetails account={account} refreshSwig={refreshSwig} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Step 1: Create Swig Account</CardTitle>
        <p className="text-slate-600 mt-2">
          Create a new Swig account that will be used for delegation to the
          backend.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleCreateAccount}
          disabled={loading}
          size="lg"
          className="w-full sm:w-auto"
        >
          {loading ? 'Creating Account...' : 'Create Swig Account'}
        </Button>
      </CardContent>
    </Card>
  );
}
