'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { SwigAccount } from '../hooks/useSwig';
import { formatSol } from '../lib/solana';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { Label } from './ui/label';

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
  const [amount, setAmount] = useState(1);
  const [amountInput, setAmountInput] = useState('1');
  const [balance, setBalance] = useState(0);

  const handleRefreshBalance = async () => {
    const newBalance = await getBalance();
    setBalance(newBalance);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty input
    if (value === '') {
      setAmountInput('');
      setAmount(0);
      return;
    }
    
    // Parse the value
    const numValue = parseFloat(value);
    
    // Only update if it's a valid number
    if (!isNaN(numValue)) {
      setAmountInput(value);
      setAmount(numValue);
    }
  };

  const handleFund = async () => {
    try {
      await fundAccount(amount);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const newBalance = await getBalance();
      setBalance(newBalance);
      onFunded();
    } catch (err) {
      console.error('Failed to fund account:', err);
    }
  };

  if (!account) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Step 2: Fund Account</CardTitle>
        <p className="text-slate-600 mt-2">
          Add SOL to your Swig account wallet. The backend will need funds to
          execute automated actions.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-slate-900">
            Amount (SOL)
          </Label>
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            value={amountInput}
            onChange={handleAmountChange}
            placeholder="1.0"
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-900">Current Balance</Label>
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleFund}
          disabled={loading || amount <= 0 || amountInput === ''}
          size="lg"
          className="w-full sm:w-auto"
        >
          {loading
            ? 'Funding Account...'
            : `Fund ${amountInput || '0'} SOL`}
        </Button>
      </CardContent>
    </Card>
  );
}
